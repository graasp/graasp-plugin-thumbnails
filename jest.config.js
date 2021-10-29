module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/test/'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  verbose: true,
};
