/** Dialogs suspend play without changing the player's pause choice. */
export function shouldPause(manual: boolean, dialogOpen: boolean, terminal: boolean): boolean {
  return manual || dialogOpen || terminal;
}
