'use strict';

// constants

const babelPrefix = 'babel-plugin-';
const pluginName = 'check-prop-types';

const reactClassNameMatcher = /^(?:React\.)?(?:Pure)?Component$/u;

const importIdentifierName = '_checkPropTypes';
const importSourceName = 'prop-types/checkPropTypes';
const arrowPropertiesIdentifierName = '_props';

// implementation

module.exports = ({ types }) => {
  let fileName;

  let importIdentifierNode;
  let importUsed = false;

  // options

  let optionClassNameMatcher;
  let optionLogIgnoredBinding = true;
  let optionLogIgnoredClass = true;

  // logging

  const logger = message => process.stderr.write(`${message}\n`);

  const warn = (option, message) => option && logger(`[${babelPrefix + pluginName}] Warning: ${message}`);

  const warnOptions = options => warn(true, `Ignored plugin options: ${JSON.stringify(options)}`);

  const getSourceFile = () => fileName && fileName !== 'unknown' ? ` "${fileName}" file` : '';
  const getSource = ({ loc: { start: { line, column } } }) => `at${getSourceFile()} ${line} line ${column} column`;

  const warnClass = ({ identifier }, superClassName) => warn(optionLogIgnoredClass,
    `Ignored propTypes ${getSource(identifier)} for class "${identifier.name}" with "${superClassName}" super class`);

  const warnBinding = (bindingType, { identifier }, type) => warn(optionLogIgnoredBinding,
    `Ignored propTypes ${getSource(identifier)} for ${bindingType} "${identifier.name}" with "${type}" type`);

  // getters

  const getMethodArgumentIdentifier = (methodNode) => {
    const [firstArgument] = methodNode.params;

    if (firstArgument) {
      if (firstArgument.type === 'Identifier') return firstArgument;

      if (firstArgument.type === 'AssignmentPattern'
        && firstArgument.left.type === 'Identifier') return firstArgument.left;
    }

    return types.identifier(arrowPropertiesIdentifierName);
  };

  const getMemberExpressionName = (node) => {
    if (node.type === 'MemberExpression') {
      return `${getMemberExpressionName(node.object)}.${getMemberExpressionName(node.property)}`;
    }

    return node.name;
  };

  // updaters

  const updateImports = (path) => {
    if (!importUsed) return;

    const importDeclaration = types.importDeclaration(
      [types.importDefaultSpecifier(importIdentifierNode)],
      types.stringLiteral(importSourceName),
    );
    path.node.body.unshift(importDeclaration);
  };

  const updateMethodBodyWithVariableDeclaration = (methodNode, identifier) => {
    methodNode.body.body.unshift(types.variableDeclaration('const', [
      types.variableDeclarator(
        identifier,
        types.identifier(arrowPropertiesIdentifierName),
      ),
    ]));
  };

  const updateMethodBodyWithValidationExpression = (binding, methodNode, statements) => {
    const [firstNode] = methodNode.body.body;
    if (firstNode && firstNode.type === 'ExpressionStatement'
      && firstNode.expression.callee.name === importIdentifierNode.name) return;

    const expression = types.expressionStatement(types.callExpression(
      importIdentifierNode, [
        ...statements,
        types.stringLiteral('prop'),
        types.logicalExpression('||',
          types.identifier(`${binding.identifier.name}.displayName`),
          types.stringLiteral(binding.identifier.name),
        ),
      ],
    ));
    methodNode.body.body.unshift(expression);

    importUsed = true;
  };

  const updateMethodArgument = (methodNode) => {
    const [firstArgument] = methodNode.params;

    const arrowPropertiesIdentifier = types.identifier(arrowPropertiesIdentifierName);
    if (!firstArgument) {
      methodNode.params.push(arrowPropertiesIdentifier);
    }

    else if (firstArgument.type === 'ObjectPattern') {
      updateMethodBodyWithVariableDeclaration(methodNode, firstArgument);
      methodNode.params[0] = arrowPropertiesIdentifier;
    }

    else if (firstArgument.type === 'AssignmentPattern' && firstArgument.left.type === 'ObjectPattern') {
      updateMethodBodyWithVariableDeclaration(methodNode, firstArgument.left);
      firstArgument.left = arrowPropertiesIdentifier;
    }
  };

  // visitors

  const visitFunctionDeclaration = (binding, functionNode) => {
    updateMethodBodyWithValidationExpression(binding, functionNode, [
      types.identifier(`${binding.identifier.name}.propTypes`),
      types.identifier('arguments[0]'),
    ]);
  };

  const visitClassDeclaration = (binding, classNode) => {
    let currentSuperClass = classNode.superClass;
    if (!currentSuperClass) return;

    if (currentSuperClass.type === 'AssignmentExpression') currentSuperClass = currentSuperClass.right;

    const fullName = getMemberExpressionName(currentSuperClass);
    if (!reactClassNameMatcher.test(fullName) && (!optionClassNameMatcher || !optionClassNameMatcher.test(fullName))) {
      warnClass(binding, fullName);
      return;
    }

    const renderNode = classNode.body.body.find(item => item.kind === 'method'
      && item.key.name === 'render' && !item.static);
    if (!renderNode) return;

    updateMethodBodyWithValidationExpression(binding, renderNode, [
      types.identifier('this.constructor.propTypes'),
      types.identifier('this.props'),
    ]);
  };

  const visitVariableDeclaration = (binding) => {
    const declarationNode = binding.path.node.init;

    if (declarationNode.type === 'FunctionExpression') {
      visitFunctionDeclaration(binding, declarationNode);
      return;
    }

    if (declarationNode.type === 'ClassExpression') {
      visitClassDeclaration(binding, declarationNode);
      return;
    }

    if (declarationNode.type !== 'ArrowFunctionExpression') {
      warnBinding('assignment', binding, declarationNode.type);
      return;
    }

    if (declarationNode.body.type !== 'BlockStatement') {
      declarationNode.body = types.blockStatement([
        types.returnStatement(declarationNode.body),
      ]);
    }

    const methodArgumentIdentifier = getMethodArgumentIdentifier(declarationNode);

    updateMethodBodyWithValidationExpression(binding, declarationNode, [
      types.identifier(`${binding.identifier.name}.propTypes`),
      methodArgumentIdentifier,
    ]);

    updateMethodArgument(declarationNode);
  };

  const visitBinding = (binding) => {
    const { type, node } = binding.path;

    switch (type) {
      case 'FunctionDeclaration': {
        visitFunctionDeclaration(binding, node);
        break;
      }

      case 'VariableDeclarator': {
        visitVariableDeclaration(binding);
        break;
      }

      case 'ClassDeclaration': {
        visitClassDeclaration(binding, node);
        break;
      }

      default: {
        warnBinding('declaration', binding, type);
      }
    }
  };

  const visitAssignmentExpression = (path) => {
    const { left } = path.node;
    if (!left.property || left.property.name !== 'propTypes') return;

    const binding = path.scope.getBinding(left.object.name);
    if (!binding) return;

    visitBinding(binding);
  };

  // options

  const parseOptions = ({
    classNameMatcher,

    logIgnoredBinding,
    logIgnoredClass,

    ...unknownOptions
  }) => {
    if (classNameMatcher !== undefined) {
      if (classNameMatcher instanceof RegExp) optionClassNameMatcher = classNameMatcher;
      else warnOptions({ classNameMatcher });
    }

    if (logIgnoredBinding !== undefined) optionLogIgnoredBinding = Boolean(logIgnoredBinding);
    if (logIgnoredClass !== undefined) optionLogIgnoredClass = Boolean(logIgnoredClass);

    if (Object.keys(unknownOptions).length > 0) warnOptions(unknownOptions);
  };

  // plugin api

  return {
    name: pluginName,

    visitor: {
      AssignmentExpression: visitAssignmentExpression,

      Program: {
        enter(path, { file, opts }) {
          fileName = file.opts.filename.slice(file.opts.cwd.length + 1);

          parseOptions(opts);

          importIdentifierNode = path.scope.generateUidIdentifier(importIdentifierName);
        },

        exit: updateImports,
      },
    },
  };
};
