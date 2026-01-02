
import { Piece, PieceType, Color } from '../types';

const BOARD_SIZE = 10;

/**
 * Basic movement rules (pseudo-legal moves)
 */
export const isValidMove = (
  startPos: [number, number],
  endPos: [number, number],
  piece: Piece,
  board: (Piece | null)[][]
): boolean => {
  const [startRow, startCol] = startPos;
  const [endRow, endCol] = endPos;

  if (endRow < 0 || endRow >= BOARD_SIZE || endCol < 0 || endCol >= BOARD_SIZE) return false;
  if (startRow === endRow && startCol === endCol) return false;

  const targetPiece = board[endRow][endCol];
  if (targetPiece && targetPiece.color === piece.color) return false;

  const dr = endRow - startRow;
  const dc = endCol - startCol;

  switch (piece.type) {
    case PieceType.PAWN: {
      const direction = piece.color === 'white' ? -1 : 1;
      const startRowInit = piece.color === 'white' ? 8 : 1;

      // Move forward
      if (dc === 0) {
        if (dr === direction && !targetPiece) return true;
        if (dr === 2 * direction && startRow === startRowInit && !targetPiece && !board[startRow + direction][startCol]) return true;
      }
      // Capture
      if (Math.abs(dc) === 1 && dr === direction && targetPiece) return true;
      return false;
    }
    case PieceType.KNIGHT: {
      return (Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2);
    }
    case PieceType.BISHOP: {
      if (Math.abs(dr) !== Math.abs(dc)) return false;
      return isPathClear(startPos, endPos, board);
    }
    case PieceType.ROOK: {
      if (dr !== 0 && dc !== 0) return false;
      return isPathClear(startPos, endPos, board);
    }
    case PieceType.QUEEN: {
      if (Math.abs(dr) !== Math.abs(dc) && dr !== 0 && dc !== 0) return false;
      return isPathClear(startPos, endPos, board);
    }
    case PieceType.KING: {
      return Math.abs(dr) <= 1 && Math.abs(dc) <= 1;
    }
    default:
      return false;
  }
};

const isPathClear = (
  start: [number, number],
  end: [number, number],
  board: (Piece | null)[][]
): boolean => {
  const [startRow, startCol] = start;
  const [endRow, endCol] = end;
  const dr = Math.sign(endRow - startRow);
  const dc = Math.sign(endCol - startCol);

  let curRow = startRow + dr;
  let curCol = startCol + dc;

  while (curRow !== endRow || curCol !== endCol) {
    if (board[curRow][curCol]) return false;
    curRow += dr;
    curCol += dc;
  }
  return true;
};

/**
 * Finds the king's position for a specific color
 */
export const findKing = (color: Color, board: (Piece | null)[][]): [number, number] | null => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c];
      if (p && p.type === PieceType.KING && p.color === color) {
        return [r, c];
      }
    }
  }
  return null;
};

/**
 * Checks if a square is under attack by pieces of a specific attacking color
 */
export const isSquareAttacked = (
  pos: [number, number],
  attackerColor: Color,
  board: (Piece | null)[][]
): boolean => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.color === attackerColor) {
        if (isValidMove([r, c], pos, piece, board)) {
          return true;
        }
      }
    }
  }
  return false;
};

/**
 * Determines if the king of the given color is in check
 */
export const isKingInCheck = (color: Color, board: (Piece | null)[][]): boolean => {
  const kingPos = findKing(color, board);
  if (!kingPos) return false;
  const opponentColor = color === 'white' ? 'black' : 'white';
  return isSquareAttacked(kingPos, opponentColor, board);
};

/**
 * Simulates a move and returns a new board state
 */
export const simulateMove = (
  start: [number, number],
  end: [number, number],
  board: (Piece | null)[][]
): (Piece | null)[][] => {
  const newBoard = board.map(row => [...row]);
  const piece = newBoard[start[0]][start[1]];
  if (!piece) return newBoard;
  
  newBoard[end[0]][end[1]] = { ...piece, position: end };
  newBoard[start[0]][start[1]] = null;
  return newBoard;
};

/**
 * Returns strictly legal moves (those that don't result in self-check)
 */
export const getLegalMoves = (
  piece: Piece,
  board: (Piece | null)[][]
): [number, number][] => {
  const pseudoMoves: [number, number][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (isValidMove(piece.position, [r, c], piece, board)) {
        // Filter out moves that leave own king in check
        const boardAfterMove = simulateMove(piece.position, [r, c], board);
        if (!isKingInCheck(piece.color, boardAfterMove)) {
          pseudoMoves.push([r, c]);
        }
      }
    }
  }
  return pseudoMoves;
};

/**
 * Checks if a player has any legal moves left (to detect checkmate or stalemate)
 */
export const hasAnyLegalMoves = (color: Color, board: (Piece | null)[][]): boolean => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        if (getLegalMoves(piece, board).length > 0) return true;
      }
    }
  }
  return false;
};
