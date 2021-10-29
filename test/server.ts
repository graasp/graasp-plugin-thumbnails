// eslint-disable-next-line @typescript-eslint/no-var-requires
const server = require('./app')({
  logger: {
    level: 'info',
    prettyPrint: true,
  },
});

server.listen(3000, (err: Error) => {
  if (err) {
    console.log(err);
    process.exit(1);
  }
});
