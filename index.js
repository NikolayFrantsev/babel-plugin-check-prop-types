import Process from 'node:process';

// constants

const babelPrefix = 'babel-plugin-';
const pluginName = 'check-prop-types';

const reactClassComponentExtends = ['Component', 'PureComponent'];

const importIdentifier = '_checkPropTypes';
const arrowPropertiesIdentifier = '_props';

// implementation

export default ({ types }) => {
  let fileName;
  let programBody;

  // options

  const optionClassComponentExtendsObject = [];
  const optionClassComponentExtends = [...reactClassComponentExtends];

  let optionLogIgnoredBinding = true;
  let optionLogIgnoredClassComponentExtends = true;

  // logging

  const warn = (option, message) => option && Process.stderr.write(`[${babelPrefix + pluginName}] Warning: ${message}\n`);

  const warnOptions = options => warn(true, `Ignored plugin options: ${JSON.stringify(options)}`);

  const getSourceFile = () => fileName && fileName !== 'unknown' ? ` "${fileName}" file` : '';
  const getSource = ({ loc: { start: { line, column } } }) => `at${getSourceFile()} ${line} line ${column} column`;

  const warnClass = ({ identifier }, superClassName, superClassObject) => warn(optionLogIgnoredClassComponentExtends,
    `Ignored propTypes ${getSource(identifier)} for class "${identifier.name}" with "${superClassObject ? `${superClassObject}.` : ''}${superClassName}" super class`);

  const warnBinding = (bindingType, { identifier }, type) => warn(optionLogIgnoredBinding,
    `Ignored propTypes ${getSource(identifier)} for ${bindingType} "${identifier.name}" with "${type}" type`);

  // updaters

  const updateImport = (binding) => {
    if (binding.path.scope.hasBinding(importIdentifier)) return;

    if (programBody.some(item => item.type === 'ImportDeclaration'
      && item.specifiers.find(specifier => specifier.local.name === importIdentifier))) return;

    const importDeclaration = types.importDeclaration(
      [types.importDefaultSpecifier(types.identifier(importIdentifier))],
      types.stringLiteral('prop-types/checkPropTypes'),
    );
    programBody.unshift(importDeclaration);
  };

  const getMethodArgument = (methodNode) => { // eslint-disable-line unicorn/consistent-function-scoping
    const [firstArgument] = methodNode.params;

    if (firstArgument) {
      if (firstArgument.type === 'Identifier') return firstArgument.name;
      if (firstArgument.type === 'AssignmentPattern'
        && firstArgument.left.type === 'Identifier') return firstArgument.left.name;
    }

    return arrowPropertiesIdentifier;
  };

  const updateMethodArgument = (methodNode) => {
    const [firstArgument] = methodNode.params;

    if (!firstArgument) {
      methodNode.params.push(types.identifier(arrowPropertiesIdentifier));
    }

    else if (firstArgument.type === 'ObjectPattern') {
      methodNode.body.body.unshift(types.variableDeclaration('const', [
        types.variableDeclarator(
          firstArgument,
          types.identifier(arrowPropertiesIdentifier),
        ),
      ]));

      methodNode.params[0] = types.identifier(arrowPropertiesIdentifier);
    }

    else if (firstArgument.type === 'AssignmentPattern' && firstArgument.left.type === 'ObjectPattern') {
      methodNode.body.body.unshift(types.variableDeclaration('const', [
        types.variableDeclarator(
          firstArgument.left,
          types.identifier(arrowPropertiesIdentifier),
        ),
      ]));

      firstArgument.left = types.identifier(arrowPropertiesIdentifier);
    }
  };

  const updateMethodBody = (binding, methodNode, statements) => {
    const [firstNode] = methodNode.body.body;
    if (firstNode && firstNode.type === 'ExpressionStatement'
      && firstNode.expression.callee.name === importIdentifier) return;

    const expression = types.expressionStatement(types.callExpression(
      types.identifier(importIdentifier), statements,
    ));
    methodNode.body.body.unshift(expression);

    updateImport(binding);
  };

  // visitors

  const visitFunctionDeclaration = (binding, functionNode) => {
    updateMethodBody(binding, functionNode, [
      types.identifier(`${binding.identifier.name}.propTypes`),
      types.identifier('arguments[0]'),
      types.stringLiteral('prop'),
      types.logicalExpression('||',
        types.identifier(`${binding.identifier.name}.displayName`),
        types.stringLiteral(binding.identifier.name),
      ),
    ]);
  };

  const visitClassDeclaration = (binding, classNode) => {
    let currentSuperClass = classNode.superClass;
    if (!currentSuperClass) return;

    if (currentSuperClass.type === 'AssignmentExpression') currentSuperClass = currentSuperClass.right;

    if (currentSuperClass.name) {
      if (!optionClassComponentExtends.includes(currentSuperClass.name)) {
        warnClass(binding, currentSuperClass.name);
        return;
      }
    }

    else {
      const { object, property } = currentSuperClass;

      if (object.name === 'React') {
        if (!reactClassComponentExtends.includes(property.name)) {
          warnClass(binding, property.name, object.name);
          return;
        }
      }

      else if (optionClassComponentExtendsObject.includes(object.name)) {
        if (!optionClassComponentExtends.includes(property.name)) {
          warnClass(binding, property.name, object.name);
          return;
        }
      }

      else {
        warnClass(binding, property.name, object.name);
        return;
      }
    }

    // ignore class if render is not regular method
    const renderNode = classNode.body.body.find(item => item.kind === 'method'
      && item.key.name === 'render' && !item.static);
    if (!renderNode) return;

    // update class render method with validation call
    updateMethodBody(binding, renderNode, [
      // always use final propTypes even for super class render
      types.identifier('this.constructor.propTypes'),
      types.identifier('this.props'),
      types.stringLiteral('prop'),
      types.logicalExpression('||',
        types.identifier(`${binding.identifier.name}.displayName`),
        types.stringLiteral(binding.identifier.name),
      ),
    ]);
  };

  const visitVariableDeclaration = (binding) => {
    const declarationNode = binding.path.node.init;

    // follow function visitor logic for function assignment
    if (declarationNode.type === 'FunctionExpression') {
      visitFunctionDeclaration(binding, declarationNode);
      return;
    }

    // follow class visitor logic for function assignment
    if (declarationNode.type === 'ClassExpression') {
      visitClassDeclaration(binding, declarationNode);
      return;
    }

    // ignore non arrow function assignment
    if (declarationNode.type !== 'ArrowFunctionExpression') {
      warnBinding('assignment', binding, declarationNode.type);
      return;
    }

    // update parenthesis arrow function with block statement
    if (declarationNode.body.type !== 'BlockStatement') {
      declarationNode.body = types.blockStatement([
        types.returnStatement(declarationNode.body),
      ]);
    }

    // get arrow function argument name
    const methodArgument = getMethodArgument(declarationNode);

    // update arrow function with validation call
    updateMethodBody(binding, declarationNode, [
      types.identifier(`${binding.identifier.name}.propTypes`),
      types.identifier(methodArgument),
      types.stringLiteral('prop'),
      types.logicalExpression('||',
        types.identifier(`${binding.identifier.name}.displayName`),
        types.stringLiteral(binding.identifier.name),
      ),
    ]);

    // update arrow function argument if needed
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

    // ignore propTypes assignment without property name
    if (!left.property || left.property.name !== 'propTypes') return;

    // find propTypes binding
    const binding = path.scope.getBinding(left.object.name);
    if (!binding) return;

    visitBinding(binding);
  };

  // plugin api

  return {
    name: pluginName,

    visitor: {

      AssignmentExpression: visitAssignmentExpression,

      Program: {
        enter(path, { file, opts: {
          classComponentExtendsObject,
          classComponentExtends,

          logIgnoredBinding,
          logIgnoredClassComponentExtends,

          ...unknownOptions
        } }) {
          fileName = file.opts.filename.slice(file.opts.cwd.length + 1);
          programBody = path.node.body;

          // options parsing

          if (classComponentExtendsObject !== undefined) {
            if (Array.isArray(classComponentExtendsObject)) optionClassComponentExtendsObject.push(...classComponentExtendsObject);
            else warnOptions({ classComponentExtendsObject });
          }

          if (classComponentExtends !== undefined) {
            if (Array.isArray(classComponentExtends)) optionClassComponentExtends.push(...classComponentExtends);
            else warnOptions({ classComponentExtends });
          }

          if (logIgnoredBinding !== undefined) optionLogIgnoredBinding = Boolean(logIgnoredBinding);
          if (logIgnoredClassComponentExtends !== undefined) optionLogIgnoredClassComponentExtends = Boolean(logIgnoredClassComponentExtends);

          if (Object.keys(unknownOptions).length > 0) {
            warnOptions(unknownOptions);
          }
        },
      },

    },
  };
};
