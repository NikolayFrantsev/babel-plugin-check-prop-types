import Process from 'node:process';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { transformAsync } from '@babel/core';

// mocks

let pluginOptions; // eslint-disable-line init-declarations
let expectedCallsForConsoleWarn; // eslint-disable-line init-declarations

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
      ['./index.js', pluginOptions],
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
