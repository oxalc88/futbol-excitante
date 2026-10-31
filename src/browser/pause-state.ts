/** Dialogs suspend play without changing the player's pause choice. */
export function shouldPause(manual: boolean, dialogOpen: boolean, terminal: boolean, blocked=false): boolean {
  return manual || dialogOpen || terminal || blocked;
}

/** Input state only needs clearing when play actually enters or leaves pause. */
export function pausedStateChanged(previous: boolean, next: boolean): boolean {
  return previous !== next;
}

/** The pause menu shows only for a player pause in a live match. */
export function showPauseMenu(manual:boolean, dialogOpen:boolean, terminal:boolean, blocked=false):boolean {
  return manual && !dialogOpen && !terminal && !blocked;
}
