# babel-plugin-check-prop-types

[Babel](https://babeljs.io) plugin to typecheck [React](https://react.dev) components with [legacy PropTypes](https://legacy.reactjs.org/docs/typechecking-with-proptypes.html#gatsby-focus-wrapper) compatible with [React 19](https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-deprecated-react-apis).

Works with [Function](https://react.dev/learn/your-first-component#defining-a-component) (including Arrow Function) and [Class](https://react.dev/reference/react/Component) (including [@decorated](https://github.com/tc39/proposal-decorators)) components, [React](https://react.dev/learn/extracting-state-logic-into-a-reducer) or [Redux](https://redux.js.org/usage/structuring-reducers/basic-reducer-structure) reducers.

Supports defining [extend](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/extends) class name [regular expression](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions) pattern with `classNameMatcher` (unset by default).

Supports debugging skipped components with `logIgnoredBinding` or `logIgnoredClass` boolean options (enabled by default).

## Examples

Input:

```js
import PropTypes from 'prop-types';

function FunctionComponent() {}
FunctionComponent.propTypes = {};

const ArrowFunctionComponent = () => {};
ArrowFunctionComponent.propTypes = {};

class ClassComponent extends React.PureComponent {
  render() {} // render method is required to validate class components
}
ClassComponent.propTypes = {};

const AnonymousFunction = function () {};
AnonymousFunction.displayName = "MyComponent";
AnonymousFunction.propTypes = {};
```

Output:

```js
import _checkPropTypes from "prop-types/checkPropTypes";

import PropTypes from 'prop-types';

function FunctionComponent() {
  _checkPropTypes(FunctionComponent.propTypes, arguments[0], "prop",
    FunctionComponent.displayName || "FunctionComponent");
}
FunctionComponent.propTypes = {};

const ArrowFunctionComponent = _props => {
  _checkPropTypes(ArrowFunctionComponent.propTypes, _props, "prop",
    ArrowFunctionComponent.displayName || "ArrowFunctionComponent");
};
ArrowFunctionComponent.propTypes = {};

class ClassComponent extends React.PureComponent {
  render() {
    _checkPropTypes(this.constructor.propTypes, this.props, "prop",
      ClassComponent.displayName || "ClassComponent");
  }
}
ClassComponent.propTypes = {};

const AnonymousFunction = function () {
  _checkPropTypes(AnonymousFunction.propTypes, arguments[0], "prop",
    AnonymousFunction.displayName || "AnonymousFunction");
};
AnonymousFunction.displayName = "MyComponent";
AnonymousFunction.propTypes = {};
```

In addition you can typecheck reducers (actually first argument of everything what looks like function):

```js
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
```

See [tests](https://github.com/NikolayFrantsev/babel-plugin-check-prop-types/blob/master/test.js) for more examples.

## Dependencies

Update [`react-is`](https://www.npmjs.com/package/react-is) for [`prop-types`](https://www.npmjs.com/package/prop-types) with [Yarn resolutions](https://classic.yarnpkg.com/lang/en/docs/selective-version-resolutions/) (otherwise you’ll get validation errors for `PropTypes.node` or `PropTypes.element`):
```json
{
  "dependencies": {
    "prop-types": "^15.8.1"
  },
  "resolutions": {
    "prop-types/react-is": "^19.0.0"
  }
}
```

## Usage

Install plugin package:

```sh
yarn add --dev babel-plugin-check-prop-types
```

Update [Babel configuration](https://babeljs.io/docs/configuration#javascript-configuration-files):

```js
export default () => {
  const plugins = [];

  if (process.env.NODE_ENV !== "production") { // enable plugin only for non-production bundle
    plugins.push(["check-prop-types", {
      // classNameMatcher: /^UI\.(.+)/,
      // logIgnoredBinding: false,
      // logIgnoredClass: false,
    }]);
  }

  return { plugins };
};
```
