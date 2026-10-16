let ioInstance = null;

const setSocketIO = (io) => {
  ioInstance = io;
};

const getSocketIO = () => {
  return ioInstance;
};

module.exports = { setSocketIO, getSocketIO };
