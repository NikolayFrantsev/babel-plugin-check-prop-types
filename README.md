# babel-plugin-check-prop-types

[Babel](https://babeljs.io) plugin to typecheck [React](https://react.dev) components with [legacy PropTypes](https://legacy.reactjs.org/docs/typechecking-with-proptypes.html#gatsby-focus-wrapper) compatible with [React 19](https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-deprecated-react-apis).

Works with [Function](https://react.dev/learn/your-first-component#defining-a-component) (including Arrow Function) and [Class](https://react.dev/reference/react/Component) (including [@decorated](https://github.com/tc39/proposal-decorators)) components, [React](https://react.dev/learn/extracting-state-logic-into-a-reducer) or [Redux](https://redux.js.org/usage/structuring-reducers/basic-reducer-structure) reducers.

Supports defining [extend](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/extends) class names with `classComponentExtends` (`Component` and `PureComponent` by default) and `classComponentExtendsObject` (`React` by default) array options.

Supports debugging skipped components with `logIgnoredBinding` or `logIgnoredClassComponentExtends` boolean options (enabled by default).

## Examples

Input:

```js
import PropTypes from 'prop-types';
import PropTypesExact from 'prop-types-exact';
import { forbidExtraProps } from 'prop-types-tools';

function FunctionComponent() {}
FunctionComponent.propTypes = { // classical object without wrapper
  myProp: PropTypes.number
};

const ArrowFunctionComponent = () => {};
ArrowFunctionComponent.propTypes = PropTypes.exact({ // you can use "exact" on root level from now
  myProp: PropTypes.number
});

class ClassComponent extends React.PureComponent {
  render() {}
}
ClassComponent.propTypes = PropTypesExact({ // just drop your "PropTypesExact" dependency
  myProp: PropTypes.number
});

const anonymousFunction = function () {};
anonymousFunction.displayName = "MyComponent";
anonymousFunction.propTypes = forbidExtraProps({ // "forbidExtraProps" makes no sense anymore
  myProp: PropTypes.number
});
```

Output:

```js
import _checkPropTypes from "prop-types/checkPropTypes";

import PropTypes from 'prop-types';
import PropTypesExact from 'prop-types-exact';
import { forbidExtraProps } from 'prop-types-tools';

function FunctionComponent() {
  _checkPropTypes(FunctionComponent.propTypes, arguments[0], "prop", FunctionComponent.displayName || "FunctionComponent");
}
FunctionComponent.propTypes = {
  myProp: PropTypes.number
};

const ArrowFunctionComponent = _props => {
  _checkPropTypes(ArrowFunctionComponent.propTypes, _props, "prop", ArrowFunctionComponent.displayName || "ArrowFunctionComponent");
};
ArrowFunctionComponent.propTypes = PropTypes.exact({
  myProp: PropTypes.number
});

class ClassComponent extends React.PureComponent {
  render() {
    _checkPropTypes(this.constructor.propTypes, this.props, "prop", this.constructor.displayName || "ClassComponent");
  }
}
ClassComponent.propTypes = PropTypesExact({
  myProp: PropTypes.number
});

const anonymousFunction = function () {
  _checkPropTypes(anonymousFunction.propTypes, arguments[0], "prop", anonymousFunction.displayName || "anonymousFunction");
};
anonymousFunction.displayName = "MyComponent";
anonymousFunction.propTypes = forbidExtraProps({
  myProp: PropTypes.number
});
```

In addition you can typecheck reducers (actually first argument of everything what looks like function):

```js
import { useReducer } from "react";
import { createStore } from "redux";

function counter(state = 0, action) {
  if (action.type === "INCREMENT") {
    return state + 1;
  } else if (action.type === "DECREMENT") {
    return state - 1;
  } else {
    return state;
  }
}
counter.propTypes = PropTypes.number.isRequired;

const ReactComponent = () => {
  const [state, dispatch] = useReducer(counter, 0);
};

const reduxStore = createStore(counter, 0);
```

See [tests](https://github.com/NikolayFrantsev/babel-plugin-check-prop-types/blob/master/test.js) for more examples.

## Usage

Install plugin package:

```sh
yarn add --dev babel-plugin-check-prop-types
```

Update [Babel configuration](https://babeljs.io/docs/configuration#javascript-configuration-files):

```js
export default () => {
  const plugins = [];

  if (process.env.NODE_ENV === "development") { // enable plugin only for development bundle
    plugins.push(["check-prop-types", {
      // classComponentExtendsObject: ["UI"],
      // classComponentExtends: ["App"],
      // logIgnoredBinding: false,
      // logIgnoredClassComponentExtends: false,
    }]);
  }

  return { plugins };
};
```

Update `react-is` for `prop-types` with [Yarn resolutions](https://classic.yarnpkg.com/lang/en/docs/selective-version-resolutions/) (otherwise you’ll get validation errors for `PropTypes.node`):
```json
{
  "resolutions": {
    "prop-types/react-is": "19"
  }
}
```
