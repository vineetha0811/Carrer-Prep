import eee from './eee.js';
import cse from './cse.js';
import ece from './ece.js';
import civil from './civil.js';
import foundations from './foundations.js';

export const QUESTION_BANKS = {
  EEE: eee,
  CSE: cse,
  ECE: ece,
  CIVIL: civil,
};

export const ALL_TECHNICAL_QUESTIONS = [...eee, ...cse, ...ece, ...civil, ...foundations];

// Branch bank is composed of the branch-specific curriculum questions plus the
// general foundation questions, so every student always has basic technical
// questions available even when their branch has no dedicated bank.
const branchBanks = new Map(
  Object.entries(QUESTION_BANKS).map(([code, bank]) => [code, [...bank, ...foundations]])
);

export function getBranchBank(branchCode) {
  return branchBanks.get(branchCode) || [...foundations];
}