
export type Color = 'white' | 'black';

export enum PieceType {
  PAWN = 'pawn',
  ROOK = 'rook',
  KNIGHT = 'knight',
  BISHOP = 'bishop',
  QUEEN = 'queen',
  KING = 'king',
}

export interface Piece {
  id: string;
  type: PieceType;
  color: Color;
  position: [number, number]; // [row, col]
  hasMoved?: boolean;
}

export interface GameState {
  board: (Piece | null)[][];
  turn: Color;
  selectedPiece: Piece | null;
  validMoves: [number, number][];
  history: string[];
  isGameOver: boolean;
  winner: Color | 'draw' | null;
}
