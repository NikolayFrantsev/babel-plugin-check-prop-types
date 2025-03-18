import Process from 'node:process';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { transformAsync } from '@babel/core';

// mocks

let pluginOptions;
let expectedCallsForConsoleWarn;

beforeEach(() => { // eslint-disable-line jest/no-hooks, jest/require-top-level-describe
  pluginOptions = {};
  expectedCallsForConsoleWarn = 0;
});

const expectCallForConsoleWarn = (count = 1) => {
  expectedCallsForConsoleWarn = count;
};

const mockProcessStderrWrite = () => {
  const real = console.log; // eslint-disable-line no-console, no-undef
  const write = jest.fn((...data) => real(...data));

  jest.spyOn(Process, 'stderr', 'get').mockReturnValue({ write });

  for (let index = 0; index < expectedCallsForConsoleWarn; index += 1) {
    write.mockReturnValueOnce();
  }

  return write;
};

// util

const transpile = async (code, options) => {
  const { currentTestName } = expect.getState();
  const filename = currentTestName.startsWith('props')
    ? ''
    : (currentTestName.startsWith('options')
        ? 'unknown'
        : `test.js#${currentTestName}`);

  const result = await transformAsync(code, {
    filename,
    ...options,
  });

  return result.code;
};

const clean = (string) => {
  const lines = string.replace(/^\n/u, '').trimEnd();
  const offset = lines.match(/^ */u)[0].length;
  return lines.replaceAll(new RegExp(`^ {${offset}}`, 'ugm'), '');
};

const assert = async (input, output = input) => {
  const mockConsoleWarn = mockProcessStderrWrite();

  const optionsParse = {
    plugins: [
      ['@babel/plugin-syntax-decorators', { version: '2023-11' }],
    ],
  };
  const optionsTranspile = {
    plugins: [
      ...optionsParse.plugins,
      ['./index.cjs', pluginOptions],
    ],
  };

  const inputTranspiled = await transpile(input, optionsTranspile);

  const inputParsed = await transpile(input, optionsParse);
  const outputParsed = await transpile(output, optionsParse);

  const inputClean = clean(input);
  const outputClean = clean(output);

  // ensure input transpiles to output
  await expect(inputTranspiled).toBe(outputClean);

  // ensure input is properly formatted
  await expect(inputParsed).toBe(inputClean);

  // ensure output is properly formatted
  await expect(outputParsed).toBe(outputClean);

  // ensure warning calls
  expect(mockConsoleWarn).toHaveBeenCalledTimes(expectedCallsForConsoleWarn);

  // ensure all assertions are called
  expect.assertions(4);
};

// templates

const TEMPLATE_IMPORT_NAME = '_checkPropTypes';
const TEMPLATE_IMPORT = `import ${TEMPLATE_IMPORT_NAME} from "prop-types/checkPropTypes";`;
const TEMPLATE_IMPORT_EXACT = 'import PropTypesExact from "prop-types-exact";';

const TEMPLATE_CHECK_FUNCTION = `${TEMPLATE_IMPORT_NAME}(MyComponent.propTypes, arguments[0], "prop", MyComponent.displayName || "MyComponent");`;
const TEMPLATE_CHECK_ARROW_ARGUMENT = '_props';
const TEMPLATE_CHECK_ARROW = `${TEMPLATE_IMPORT_NAME}(MyComponent.propTypes, ${TEMPLATE_CHECK_ARROW_ARGUMENT}, "prop", MyComponent.displayName || "MyComponent");`;
const TEMPLATE_CHECK_CLASS = `${TEMPLATE_IMPORT_NAME}(this.constructor.propTypes, this.props, "prop", MyComponent.displayName || "MyComponent");`;

const TEMPLATE_EXPRESSION = 'console.info("render");';

const TEMPLATE_CLASS_RENDER = 'render() {}';
const TEMPLATE_CLASS_RENDER_CHECKED = `render() {
    ${TEMPLATE_CHECK_CLASS}
  }`;

const TEMPLATE_TYPES_SCHEMA = `{
  myProp: PropTypes.number
}`;
const TEMPLATE_TYPES = `MyComponent.propTypes = ${TEMPLATE_TYPES_SCHEMA};`;
const TEMPLATE_TYPES_EXACT = `MyComponent.propTypes = PropTypesExact(${TEMPLATE_TYPES_SCHEMA});`;

// tests

/* eslint-disable jest/expect-expect */
/* eslint-disable jest/prefer-expect-assertions */

describe('samples', () => {
  it('readme', () => assert(`
    import PropTypes from 'prop-types';
    function FunctionComponent() {}
    FunctionComponent.propTypes = {};
    const ArrowFunctionComponent = () => {};
    ArrowFunctionComponent.propTypes = {};
    class ClassComponent extends React.PureComponent {
      render() {}
    }
    ClassComponent.propTypes = {};
    const AnonymousFunction = function () {};
    AnonymousFunction.displayName = "MyComponent";
    AnonymousFunction.propTypes = {};
  `, `
    ${TEMPLATE_IMPORT}
    import PropTypes from 'prop-types';
    function FunctionComponent() {
      ${TEMPLATE_CHECK_FUNCTION.replaceAll('MyComponent', 'FunctionComponent')}
    }
    FunctionComponent.propTypes = {};
    const ArrowFunctionComponent = ${TEMPLATE_CHECK_ARROW_ARGUMENT} => {
      ${TEMPLATE_CHECK_ARROW.replaceAll('MyComponent', 'ArrowFunctionComponent')}
    };
    ArrowFunctionComponent.propTypes = {};
    class ClassComponent extends React.PureComponent {
      render() {
        ${TEMPLATE_CHECK_CLASS.replaceAll('MyComponent', 'ClassComponent')}
      }
    }
    ClassComponent.propTypes = {};
    const AnonymousFunction = function () {
      ${TEMPLATE_CHECK_FUNCTION.replaceAll('MyComponent', 'AnonymousFunction')}
    };
    AnonymousFunction.displayName = "MyComponent";
    AnonymousFunction.propTypes = {};
  `));

  it('reducer', () => assert(`
    import { useReducer } from "react";
    import { createStore } from "redux";
    function counter(state, action) {
      if (action.type === "INCREMENT") return state + 1;
      if (action.type === "DECREMENT") return state - 1;
      return state;
    }
    counter.propTypes = PropTypes.number.isRequired;
    const ReactComponent = () => {
      const [state, dispatch] = useReducer(counter, 0);
    };
    const reduxStore = createStore(counter, 0);
  `, `
    ${TEMPLATE_IMPORT}
    import { useReducer } from "react";
    import { createStore } from "redux";
    function counter(state, action) {
      ${TEMPLATE_CHECK_FUNCTION.replaceAll('MyComponent', 'counter')}
      if (action.type === "INCREMENT") return state + 1;
      if (action.type === "DECREMENT") return state - 1;
      return state;
    }
    counter.propTypes = PropTypes.number.isRequired;
    const ReactComponent = () => {
      const [state, dispatch] = useReducer(counter, 0);
    };
    const reduxStore = createStore(counter, 0);
  `));
});

describe('import', () => {
  it('required', () => assert(`
    function MyComponent() {}
    ${TEMPLATE_TYPES}
  `, `
    ${TEMPLATE_IMPORT}
    function MyComponent() {
      ${TEMPLATE_CHECK_FUNCTION}
    }
    ${TEMPLATE_TYPES}
  `));

  it('exists', () => assert(`
    ${TEMPLATE_IMPORT}
    function MyComponent() {}
    ${TEMPLATE_TYPES}
  `, `
    ${TEMPLATE_IMPORT}
    function MyComponent() {
      ${TEMPLATE_CHECK_FUNCTION}
    }
    ${TEMPLATE_TYPES}
  `));

  it('scoped', () => assert(`
    const ${TEMPLATE_IMPORT_NAME} = () => {};
    function MyComponent() {}
    ${TEMPLATE_TYPES}
  `, `
    ${TEMPLATE_IMPORT.replace('_checkPropTypes', '_checkPropTypes2')}
    const ${TEMPLATE_IMPORT_NAME} = () => {};
    function MyComponent() {
      ${TEMPLATE_CHECK_FUNCTION.replace('_checkPropTypes', '_checkPropTypes2')}
    }
    ${TEMPLATE_TYPES}
  `));
});

describe('binding', () => {
  describe('function', () => {
    it('empty', () => assert(`
      function MyComponent() {}
      ${TEMPLATE_TYPES}
    `, `
      ${TEMPLATE_IMPORT}
      function MyComponent() {
        ${TEMPLATE_CHECK_FUNCTION}
      }
      ${TEMPLATE_TYPES}
    `));

    it('expression', () => assert(`
      function MyComponent() {
        ${TEMPLATE_EXPRESSION}
      }
      ${TEMPLATE_TYPES}
    `, `
      ${TEMPLATE_IMPORT}
      function MyComponent() {
        ${TEMPLATE_CHECK_FUNCTION}
        ${TEMPLATE_EXPRESSION}
      }
      ${TEMPLATE_TYPES}
    `));

    describe('assignment', () => {
      it('anonymous', () => assert(`
        const MyComponent = function () {};
        ${TEMPLATE_TYPES}
      `, `
        ${TEMPLATE_IMPORT}
        const MyComponent = function () {
          ${TEMPLATE_CHECK_FUNCTION}
        };
        ${TEMPLATE_TYPES}
      `));

      it('named', () => assert(`
        const MyComponent = function myComponent() {};
        ${TEMPLATE_TYPES}
      `, `
        ${TEMPLATE_IMPORT}
        const MyComponent = function myComponent() {
          ${TEMPLATE_CHECK_FUNCTION}
        };
        ${TEMPLATE_TYPES}
      `));
    });
  });

  describe('arrow', () => {
    it('braceless', () => assert(`
      const MyComponent = () => null;
      ${TEMPLATE_TYPES}
    `, `
      ${TEMPLATE_IMPORT}
      const MyComponent = ${TEMPLATE_CHECK_ARROW_ARGUMENT} => {
        ${TEMPLATE_CHECK_ARROW}
        return null;
      };
      ${TEMPLATE_TYPES}
    `));

    describe('braces', () => {
      it('empty', () => assert(`
        const MyComponent = () => {};
        ${TEMPLATE_TYPES}
      `, `
        ${TEMPLATE_IMPORT}
        const MyComponent = ${TEMPLATE_CHECK_ARROW_ARGUMENT} => {
          ${TEMPLATE_CHECK_ARROW}
        };
        ${TEMPLATE_TYPES}
      `));

      it('expression', () => assert(`
        const MyComponent = () => {
          ${TEMPLATE_EXPRESSION}
        };
        ${TEMPLATE_TYPES}
      `, `
        ${TEMPLATE_IMPORT}
        const MyComponent = ${TEMPLATE_CHECK_ARROW_ARGUMENT} => {
          ${TEMPLATE_CHECK_ARROW}
          ${TEMPLATE_EXPRESSION}
        };
        ${TEMPLATE_TYPES}
      `));

      describe('argument', () => {
        it('match', () => assert(`
          const MyComponent = ${TEMPLATE_CHECK_ARROW_ARGUMENT} => {
            ${TEMPLATE_EXPRESSION}
          };
          ${TEMPLATE_TYPES}
        `, `
          ${TEMPLATE_IMPORT}
          const MyComponent = ${TEMPLATE_CHECK_ARROW_ARGUMENT} => {
            ${TEMPLATE_CHECK_ARROW}
            ${TEMPLATE_EXPRESSION}
          };
          ${TEMPLATE_TYPES}
        `));

        it('mismatch', () => assert(`
          const MyComponent = myProps => {
            ${TEMPLATE_EXPRESSION}
          };
          ${TEMPLATE_TYPES}
        `, `
          ${TEMPLATE_IMPORT}
          const MyComponent = myProps => {
            ${TEMPLATE_CHECK_ARROW.replace(TEMPLATE_CHECK_ARROW_ARGUMENT, 'myProps')}
            ${TEMPLATE_EXPRESSION}
          };
          ${TEMPLATE_TYPES}
        `));

        it('destructured', () => assert(`
          const MyComponent = ({
            prop
          }) => {
            ${TEMPLATE_EXPRESSION}
          };
          ${TEMPLATE_TYPES}
        `, `
          ${TEMPLATE_IMPORT}
          const MyComponent = ${TEMPLATE_CHECK_ARROW_ARGUMENT} => {
            const {
              prop
            } = ${TEMPLATE_CHECK_ARROW_ARGUMENT};
            ${TEMPLATE_CHECK_ARROW}
            ${TEMPLATE_EXPRESSION}
          };
          ${TEMPLATE_TYPES}
        `));

        describe('assignment', () => {
          it('match', () => assert(`
            const MyComponent = (myProps = {
              myProp: 1
            }) => {
              ${TEMPLATE_EXPRESSION}
            };
            ${TEMPLATE_TYPES}
          `, `
            ${TEMPLATE_IMPORT}
            const MyComponent = (myProps = {
              myProp: 1
            }) => {
              ${TEMPLATE_CHECK_ARROW.replace(TEMPLATE_CHECK_ARROW_ARGUMENT, 'myProps')}
              ${TEMPLATE_EXPRESSION}
            };
            ${TEMPLATE_TYPES}
          `));

          it('mismatch', () => assert(`
            const MyComponent = (myProps = {
              myProp: 1
            }) => {
              ${TEMPLATE_EXPRESSION}
            };
            ${TEMPLATE_TYPES}
          `, `
            ${TEMPLATE_IMPORT}
            const MyComponent = (myProps = {
              myProp: 1
            }) => {
              ${TEMPLATE_CHECK_ARROW.replace(TEMPLATE_CHECK_ARROW_ARGUMENT, 'myProps')}
              ${TEMPLATE_EXPRESSION}
            };
            ${TEMPLATE_TYPES}
          `));

          it('complex', () => assert(`
            const MyComponent = ({
              myProp,
              secondProp = 2,
              ...restProps
            } = {
              myProp: 1
            }, second) => {
              ${TEMPLATE_EXPRESSION}
            };
            ${TEMPLATE_TYPES}
          `, `
            ${TEMPLATE_IMPORT}
            const MyComponent = (${TEMPLATE_CHECK_ARROW_ARGUMENT} = {
              myProp: 1
            }, second) => {
              const {
                myProp,
                secondProp = 2,
                ...restProps
              } = ${TEMPLATE_CHECK_ARROW_ARGUMENT};
              ${TEMPLATE_CHECK_ARROW}
              ${TEMPLATE_EXPRESSION}
            };
            ${TEMPLATE_TYPES}
          `));
        });
      });
    });
  });

  describe('class', () => {
    it('basic', () => assert(`
      class MyComponent {}
      ${TEMPLATE_TYPES}
    `));

    it('extended', () => assert(`
      class MyComponent extends Component {}
      ${TEMPLATE_TYPES}
    `));

    describe('render', () => {
      it('component', () => assert(`
        class MyComponent extends Component {
          ${TEMPLATE_CLASS_RENDER}
        }
        ${TEMPLATE_TYPES}
      `, `
        ${TEMPLATE_IMPORT}
        class MyComponent extends Component {
          ${TEMPLATE_CLASS_RENDER_CHECKED}
        }
        ${TEMPLATE_TYPES}
      `));

      it('pure component', () => assert(`
        class MyComponent extends PureComponent {
          ${TEMPLATE_CLASS_RENDER}
        }
        ${TEMPLATE_TYPES}
      `, `
        ${TEMPLATE_IMPORT}
        class MyComponent extends PureComponent {
          ${TEMPLATE_CLASS_RENDER_CHECKED}
        }
        ${TEMPLATE_TYPES}
      `));

      it('react component', () => assert(`
        class MyComponent extends React.Component {
          ${TEMPLATE_CLASS_RENDER}
        }
        ${TEMPLATE_TYPES}
      `, `
        ${TEMPLATE_IMPORT}
        class MyComponent extends React.Component {
          ${TEMPLATE_CLASS_RENDER_CHECKED}
        }
        ${TEMPLATE_TYPES}
      `));

      it('react pure component', () => assert(`
        class MyComponent extends React.PureComponent {
          ${TEMPLATE_CLASS_RENDER}
        }
        ${TEMPLATE_TYPES}
      `, `
        ${TEMPLATE_IMPORT}
        class MyComponent extends React.PureComponent {
          ${TEMPLATE_CLASS_RENDER_CHECKED}
        }
        ${TEMPLATE_TYPES}
      `));

      it('react fragment', async () => {
        expectCallForConsoleWarn();

        await assert(`
          class MyComponent extends React.Fragment {
            ${TEMPLATE_CLASS_RENDER}
          }
          ${TEMPLATE_TYPES}
        `);
      });

      it('object', async () => {
        expectCallForConsoleWarn();

        await assert(`
          class MyComponent extends Object {
            ${TEMPLATE_CLASS_RENDER}
          }
          ${TEMPLATE_TYPES}
        `);
      });

      it('app', async () => {
        pluginOptions.classComponentExtends = ['App'];

        await assert(`
          class MyComponent extends App {
            ${TEMPLATE_CLASS_RENDER}
          }
          ${TEMPLATE_TYPES}
        `, `
          ${TEMPLATE_IMPORT}
          class MyComponent extends App {
            ${TEMPLATE_CLASS_RENDER_CHECKED}
          }
          ${TEMPLATE_TYPES}
        `);
      });

      it('ui app', async () => {
        pluginOptions.classComponentExtendsObject = ['UI'];
        pluginOptions.classComponentExtends = ['App'];

        await assert(`
          class MyComponent extends UI.App {
            ${TEMPLATE_CLASS_RENDER}
          }
          ${TEMPLATE_TYPES}
        `, `
          ${TEMPLATE_IMPORT}
          class MyComponent extends UI.App {
            ${TEMPLATE_CLASS_RENDER_CHECKED}
          }
          ${TEMPLATE_TYPES}
        `);
      });

      it('ui page', async () => {
        pluginOptions.classComponentExtendsObject = ['UI'];

        expectCallForConsoleWarn();

        await assert(`
          class MyComponent extends UI.Page {
            ${TEMPLATE_CLASS_RENDER}
          }
          ${TEMPLATE_TYPES}
        `);
      });

      it('import', () => assert(`
        import Component from './BaseComponent';
        class MyComponent extends Component {
          ${TEMPLATE_CLASS_RENDER}
        }
        ${TEMPLATE_TYPES}
      `, `
        ${TEMPLATE_IMPORT}
        import Component from './BaseComponent';
        class MyComponent extends Component {
          ${TEMPLATE_CLASS_RENDER_CHECKED}
        }
        ${TEMPLATE_TYPES}
      `));

      it('anonymous', () => assert(`
        const MyComponent = class extends Component {
          ${TEMPLATE_CLASS_RENDER}
        };
        ${TEMPLATE_TYPES}
      `, `
        ${TEMPLATE_IMPORT}
        const MyComponent = class extends Component {
          ${TEMPLATE_CLASS_RENDER_CHECKED}
        };
        ${TEMPLATE_TYPES}
      `));

      it('assignment', () => assert(`
        const MyComponent = class myComponent extends Component {
          ${TEMPLATE_CLASS_RENDER}
        };
        ${TEMPLATE_TYPES}
      `, `
        ${TEMPLATE_IMPORT}
        const MyComponent = class myComponent extends Component {
          ${TEMPLATE_CLASS_RENDER_CHECKED}
        };
        ${TEMPLATE_TYPES}
      `));

      it('inheritance', async () => {
        expectCallForConsoleWarn();

        await assert(`
          class MyComponent extends Component {
            ${TEMPLATE_CLASS_RENDER}
          }
          ${TEMPLATE_TYPES}
          class MyComponent2 extends MyComponent {}
          ${TEMPLATE_TYPES.replace('MyComponent', 'MyComponent2')}
        `, `
          ${TEMPLATE_IMPORT}
          class MyComponent extends Component {
            ${TEMPLATE_CLASS_RENDER_CHECKED}
          }
          ${TEMPLATE_TYPES}
          class MyComponent2 extends MyComponent {}
          ${TEMPLATE_TYPES.replace('MyComponent', 'MyComponent2')}
        `);
      });

      describe('invalid', () => {
        it('getter', () => assert(`
          class MyComponent extends Component {
            get render() {}
          }
          ${TEMPLATE_TYPES}
        `));

        it('static', () => assert(`
          class MyComponent extends Component {
            static {}
            static render() {}
          }
          ${TEMPLATE_TYPES}
        `));
      });

      describe('decorator', () => {
        it('class', () => assert(`
          @decorate
          class MyComponent extends Component {
            ${TEMPLATE_CLASS_RENDER}
          }
          ${TEMPLATE_TYPES}
        `, `
          ${TEMPLATE_IMPORT}
          @decorate
          class MyComponent extends Component {
            ${TEMPLATE_CLASS_RENDER_CHECKED}
          }
          ${TEMPLATE_TYPES}
        `));

        it('method', () => assert(`
          class MyComponent extends Component {
            @decorate
            ${TEMPLATE_CLASS_RENDER}
          }
          ${TEMPLATE_TYPES}
        `, `
          ${TEMPLATE_IMPORT}
          class MyComponent extends Component {
            @decorate
            ${TEMPLATE_CLASS_RENDER_CHECKED}
          }
          ${TEMPLATE_TYPES}
        `));

        describe('compiled', () => {
          it('component', () => assert(`
            class MyComponent extends (_Component = Component) {
              ${TEMPLATE_CLASS_RENDER}
            }
            ${TEMPLATE_TYPES}
          `, `
            ${TEMPLATE_IMPORT}
            class MyComponent extends (_Component = Component) {
              ${TEMPLATE_CLASS_RENDER_CHECKED}
            }
            ${TEMPLATE_TYPES}
          `));

          it('react component', () => assert(`
            class MyComponent extends (_React$Component = React.Component) {
              ${TEMPLATE_CLASS_RENDER}
            }
            ${TEMPLATE_TYPES}
          `, `
            ${TEMPLATE_IMPORT}
            class MyComponent extends (_React$Component = React.Component) {
              ${TEMPLATE_CLASS_RENDER_CHECKED}
            }
            ${TEMPLATE_TYPES}
          `));

          it('app', async () => {
            pluginOptions.classComponentExtends = ['App'];

            await assert(`
              class MyComponent extends (_App = App) {
                ${TEMPLATE_CLASS_RENDER}
              }
              ${TEMPLATE_TYPES}
            `, `
              ${TEMPLATE_IMPORT}
              class MyComponent extends (_App = App) {
                ${TEMPLATE_CLASS_RENDER_CHECKED}
              }
              ${TEMPLATE_TYPES}
            `);
          });
        });
      });
    });
  });
});

describe('props', () => {
  describe('missing', () => {
    it('function', () => assert(`
      function Component() {}
    `));

    it('arrow', () => assert(`
      const Component = () => {};
    `));

    it('class', () => assert(`
      class Component extends Component {
        ${TEMPLATE_CLASS_RENDER}
      }
    `));
  });

  describe('invalid', () => {
    it('function', () => assert(`
      function Component() {}
      ${TEMPLATE_TYPES}
    `));

    it('arrow', () => assert(`
      const Component = () => {};
      ${TEMPLATE_TYPES}
    `));

    it('class', () => assert(`
      class Component extends Component {
        ${TEMPLATE_CLASS_RENDER}
      }
      ${TEMPLATE_TYPES}
    `));
  });

  describe('valid', () => {
    it('function', () => assert(`
      function MyComponent() {}
      ${TEMPLATE_TYPES}
    `, `
      ${TEMPLATE_IMPORT}
      function MyComponent() {
        ${TEMPLATE_CHECK_FUNCTION}
      }
      ${TEMPLATE_TYPES}
    `));

    it('arrow', () => assert(`
      const MyComponent = () => {};
      ${TEMPLATE_TYPES}
    `, `
      ${TEMPLATE_IMPORT}
      const MyComponent = ${TEMPLATE_CHECK_ARROW_ARGUMENT} => {
        ${TEMPLATE_CHECK_ARROW}
      };
      ${TEMPLATE_TYPES}
    `));

    it('class', () => assert(`
      class MyComponent extends Component {
        ${TEMPLATE_CLASS_RENDER}
      }
      ${TEMPLATE_TYPES}
    `, `
      ${TEMPLATE_IMPORT}
      class MyComponent extends Component {
        ${TEMPLATE_CLASS_RENDER_CHECKED}
      }
      ${TEMPLATE_TYPES}
    `));
  });

  describe('exact', () => {
    it('function', () => assert(`
      ${TEMPLATE_IMPORT_EXACT}
      function MyComponent() {}
      ${TEMPLATE_TYPES_EXACT}
    `, `
      ${TEMPLATE_IMPORT}
      ${TEMPLATE_IMPORT_EXACT}
      function MyComponent() {
        ${TEMPLATE_CHECK_FUNCTION}
      }
      ${TEMPLATE_TYPES_EXACT}
    `));

    it('arrow', () => assert(`
      ${TEMPLATE_IMPORT_EXACT}
      const MyComponent = () => {};
      ${TEMPLATE_TYPES_EXACT}
    `, `
      ${TEMPLATE_IMPORT}
      ${TEMPLATE_IMPORT_EXACT}
      const MyComponent = ${TEMPLATE_CHECK_ARROW_ARGUMENT} => {
        ${TEMPLATE_CHECK_ARROW}
      };
      ${TEMPLATE_TYPES_EXACT}
    `));

    it('class', () => assert(`
      ${TEMPLATE_IMPORT_EXACT}
      class MyComponent extends Component {
        ${TEMPLATE_CLASS_RENDER}
      }
      ${TEMPLATE_TYPES_EXACT}
    `, `
      ${TEMPLATE_IMPORT}
      ${TEMPLATE_IMPORT_EXACT}
      class MyComponent extends Component {
        ${TEMPLATE_CLASS_RENDER_CHECKED}
      }
      ${TEMPLATE_TYPES_EXACT}
    `));
  });

  describe('unknown', () => {
    it('condition', () => assert(`
      const MyComponent = () => {};
      if (process.env.NODE_ENV !== 'production') {
        ${TEMPLATE_TYPES.split('\n').join('\n  ')}
      }
    `, `
      ${TEMPLATE_IMPORT}
      const MyComponent = ${TEMPLATE_CHECK_ARROW_ARGUMENT} => {
        ${TEMPLATE_CHECK_ARROW}
      };
      if (process.env.NODE_ENV !== 'production') {
        ${TEMPLATE_TYPES.split('\n').join('\n  ')}
      }
    `));

    it('unbound', async () => {
      expectCallForConsoleWarn();

      await assert(`
        const MyComponent = null;
        ${TEMPLATE_TYPES}
      `);
    });

    it('import', async () => {
      expectCallForConsoleWarn();

      await assert(`
        import MyComponent from './MyComponent';
        ${TEMPLATE_TYPES}
      `);
    });

    it('override', () => assert(`
      const MyComponent = () => {};
      ${TEMPLATE_TYPES}
      ${TEMPLATE_TYPES_EXACT}
    `, `
      ${TEMPLATE_IMPORT}
      const MyComponent = ${TEMPLATE_CHECK_ARROW_ARGUMENT} => {
        ${TEMPLATE_CHECK_ARROW}
      };
      ${TEMPLATE_TYPES}
      ${TEMPLATE_TYPES_EXACT}
    `));

    it('double', () => assert(`
      const MyComponent = () => {};
      ${TEMPLATE_TYPES_EXACT}
      const MyComponent2 = () => {};
      ${TEMPLATE_TYPES.replace('MyComponent', 'MyComponent2')}
    `, `
      ${TEMPLATE_IMPORT}
      const MyComponent = ${TEMPLATE_CHECK_ARROW_ARGUMENT} => {
        ${TEMPLATE_CHECK_ARROW}
      };
      ${TEMPLATE_TYPES_EXACT}
      const MyComponent2 = ${TEMPLATE_CHECK_ARROW_ARGUMENT} => {
        ${TEMPLATE_CHECK_ARROW.replaceAll('MyComponent', 'MyComponent2')}
      };
      ${TEMPLATE_TYPES.replace('MyComponent', 'MyComponent2')}
    `));

    it('assignment', () => assert(`
      const propTypes = ${TEMPLATE_TYPES_SCHEMA};
    `));

    it('multi', () => assert(`
      const MyComponent = () => {};
      const propTypes = ${TEMPLATE_TYPES}
    `, `
      ${TEMPLATE_IMPORT}
      const MyComponent = ${TEMPLATE_CHECK_ARROW_ARGUMENT} => {
        ${TEMPLATE_CHECK_ARROW}
      };
      const propTypes = ${TEMPLATE_TYPES}
    `));

    it('parens', () => assert(`
      (() => {}).propTypes = {};
    `));
  });
});

describe('options', () => {
  describe('classComponentExtends', () => {
    it('unset', async () => {
      expectCallForConsoleWarn();

      await assert(`
        class MyComponent extends App {
          ${TEMPLATE_CLASS_RENDER}
        }
        ${TEMPLATE_TYPES}
      `);
    });

    it('match', async () => {
      pluginOptions.classComponentExtends = ['App'];

      await assert(`
        class MyComponent extends App {
          ${TEMPLATE_CLASS_RENDER}
        }
        ${TEMPLATE_TYPES}
      `, `
        ${TEMPLATE_IMPORT}
        class MyComponent extends App {
          ${TEMPLATE_CLASS_RENDER_CHECKED}
        }
        ${TEMPLATE_TYPES}
      `);
    });

    it('mismatch', async () => {
      pluginOptions.classComponentExtends = ['App2'];

      expectCallForConsoleWarn();

      await assert(`
        class MyComponent extends App {
          ${TEMPLATE_CLASS_RENDER}
        }
        ${TEMPLATE_TYPES}
      `);
    });
  });

  describe('classComponentExtendsObject', () => {
    it('unset', async () => {
      expectCallForConsoleWarn();

      await assert(`
        class MyComponent extends UI.App {
          ${TEMPLATE_CLASS_RENDER}
        }
        ${TEMPLATE_TYPES}
      `);
    });

    it('match', async () => {
      pluginOptions.classComponentExtendsObject = ['UI'];
      pluginOptions.classComponentExtends = ['App'];

      await assert(`
        class MyComponent extends UI.App {
          ${TEMPLATE_CLASS_RENDER}
        }
        ${TEMPLATE_TYPES}
      `, `
        ${TEMPLATE_IMPORT}
        class MyComponent extends UI.App {
          ${TEMPLATE_CLASS_RENDER_CHECKED}
        }
        ${TEMPLATE_TYPES}
      `);
    });

    describe('mismatch', () => {
      it('object', async () => {
        pluginOptions.classComponentExtendsObject = ['UI2'];
        pluginOptions.classComponentExtends = ['App'];

        expectCallForConsoleWarn();

        await assert(`
          class MyComponent extends UI.App {
            ${TEMPLATE_CLASS_RENDER}
          }
          ${TEMPLATE_TYPES}
        `);
      });

      it('property', async () => {
        pluginOptions.classComponentExtendsObject = ['UI'];
        pluginOptions.classComponentExtends = ['App2'];

        expectCallForConsoleWarn();

        await assert(`
          class MyComponent extends UI.App {
            ${TEMPLATE_CLASS_RENDER}
          }
          ${TEMPLATE_TYPES}
        `);
      });
    });
  });

  describe('logIgnoredBinding', () => {
    it('positive', async () => {
      expectCallForConsoleWarn();

      await assert(`
        const MyComponent = null;
        ${TEMPLATE_TYPES}
      `);
    });

    it('negative', async () => {
      pluginOptions.logIgnoredBinding = false;

      await assert(`
        const MyComponent = null;
        ${TEMPLATE_TYPES}
      `);
    });
  });

  describe('logIgnoredClassComponentExtends', () => {
    it('positive', async () => {
      expectCallForConsoleWarn();

      await assert(`
        class MyComponent extends UI.App {
          ${TEMPLATE_CLASS_RENDER}
        }
        ${TEMPLATE_TYPES}
      `);
    });

    it('negative', async () => {
      pluginOptions.logIgnoredClassComponentExtends = false;

      await assert(`
        class MyComponent extends UI.App {
          ${TEMPLATE_CLASS_RENDER}
        }
        ${TEMPLATE_TYPES}
      `);
    });
  });

  it('invalid', async () => {
    pluginOptions.classComponentExtendsObject = 'UI';
    pluginOptions.classComponentExtends = 'App';

    expectCallForConsoleWarn(2);

    await assert(`
      const MyComponent = () => null;
    `);
  });

  it('unknown', async () => {
    pluginOptions.unknown = true;

    expectCallForConsoleWarn();

    await assert(`
      const MyComponent = () => null;
    `);
  });
});
