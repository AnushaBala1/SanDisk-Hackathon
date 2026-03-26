// state.js — shared in-memory state for the session
const state = {
  totalBlocks: 1600,
  badBlocks: []   // array of block indices that are bad
};

module.exports = state;