// backend/state.js
const state = {
  totalBlocks: 1600,
  badBlocks: [],

  // New for P2 - Logic Minimizer
  currentFunction: "gc_trigger",   // "gc_trigger", "wear_leveling", "oob_threshold"

  functions: {
    gc_trigger: {
      name: "GC Trigger",
      variables: ["A", "B", "C", "D"],
      minterms: [0, 1, 2, 4, 5, 8, 10, 12],
      dontcares: [3, 6, 9, 11],
      originalGates: 12,
      description: "Triggers garbage collection when free blocks are low"
    },
    wear_leveling: {
      name: "Wear Leveling",
      variables: ["A", "B", "C", "D", "E"],     // 5 variables
      minterms: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31],
      dontcares: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
      originalGates: 31,
      description: "Decides when to swap blocks for even wear"
    },
    oob_threshold: {
      name: "OOB Threshold",
      variables: ["A", "B", "C", "D"],           // 4 variables but different logic
      minterms: [7, 11, 13, 14, 15],
      dontcares: [3, 5, 6, 9, 10, 12],
      originalGates: 9,
      description: "Out-of-Band alert threshold decision logic"
    }
  }
};

module.exports = state;