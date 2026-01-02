
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Color, Piece, PieceType, GameState } from './types';
import { PieceIcons, UI_ICONS } from './constants';
import { 
  getLegalMoves, 
  isKingInCheck, 
  hasAnyLegalMoves, 
  simulateMove,
  findKing 
} from './utils/moveLogic';

declare var Peer: any;

const BOARD_SIZE = 10;

const initialPieces = (): (Piece | null)[][] => {
  const board: (Piece | null)[][] = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

  const createBackRow = (color: Color, row: number): void => {
    const layout = [
      PieceType.PAWN, PieceType.ROOK, PieceType.KNIGHT, PieceType.BISHOP, PieceType.QUEEN,
      PieceType.KING, PieceType.BISHOP, PieceType.KNIGHT, PieceType.ROOK, PieceType.PAWN,
    ];
    layout.forEach((type, col) => {
      board[row][col] = {
        id: `${color}-${type}-${row}-${col}`,
        type,
        color,
        position: [row, col],
        hasMoved: false
      };
    });
  };

  const createPawnRow = (color: Color, row: number): void => {
    for (let col = 0; col < BOARD_SIZE; col++) {
      board[row][col] = {
        id: `${color}-pawn-${row}-${col}`,
        type: PieceType.PAWN,
        color,
        position: [row, col],
        hasMoved: false
      };
    }
  };

  createBackRow('black', 0);
  createPawnRow('black', 1);
  createPawnRow('white', 8);
  createBackRow('white', 9);

  return board;
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState & { isCheck: boolean }>({
    board: initialPieces(),
    turn: 'white',
    selectedPiece: null,
    validMoves: [],
    history: [],
    isGameOver: false,
    winner: null,
    isCheck: false
  });

  const [myColor, setMyColor] = useState<Color | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'waiting' | 'connected' | 'error'>('idle');
  const [roomId, setRoomId] = useState<string>('');
  const peerRef = useRef<any>(null);
  const connRef = useRef<any>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id: string) => {
      if (roomFromUrl) {
        setRoomId(roomFromUrl);
        setMyColor('black');
        setConnectionStatus('waiting');
        const conn = peer.connect(roomFromUrl);
        setupConnection(conn);
      } else {
        setRoomId(id.slice(0, 6));
        setMyColor('white');
        setConnectionStatus('waiting');
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?room=' + id;
        window.history.pushState({ path: newUrl }, '', newUrl);
      }
    });

    peer.on('connection', (conn: any) => {
      if (!connRef.current) {
        setupConnection(conn);
        setConnectionStatus('connected');
      }
    });

    return () => peerRef.current?.destroy();
  }, []);

  const setupConnection = (conn: any) => {
    connRef.current = conn;
    conn.on('open', () => setConnectionStatus('connected'));
    conn.on('data', (data: any) => {
      if (data.type === 'MOVE' || data.type === 'RESET') setGameState(data.state);
    });
    conn.on('close', () => setConnectionStatus('error'));
  };

  const handleCellClick = (row: number, col: number) => {
    if (gameState.isGameOver || gameState.turn !== myColor) return;
    const clickedPiece = gameState.board[row][col];

    if (gameState.selectedPiece) {
      const isValid = gameState.validMoves.some(([r, c]) => r === row && c === col);
      if (isValid) {
        movePiece(gameState.selectedPiece, [row, col]);
        return;
      }
    }

    if (clickedPiece && clickedPiece.color === gameState.turn) {
      setGameState(prev => ({
        ...prev,
        selectedPiece: clickedPiece,
        validMoves: getLegalMoves(clickedPiece, prev.board),
      }));
    } else {
      setGameState(prev => ({ ...prev, selectedPiece: null, validMoves: [] }));
    }
  };

  const movePiece = (piece: Piece, target: [number, number]) => {
    const [targetRow, targetCol] = target;
    const [startRow, startCol] = piece.position;
    const nextBoard = simulateMove([startRow, startCol], [targetRow, targetCol], gameState.board);
    const nextTurn: Color = gameState.turn === 'white' ? 'black' : 'white';
    const isCheck = isKingInCheck(nextTurn, nextBoard);
    
    let isGameOver = false;
    let winner: Color | 'draw' | null = null;
    if (!hasAnyLegalMoves(nextTurn, nextBoard)) {
      isGameOver = true;
      winner = isCheck ? gameState.turn : 'draw';
    }

    const moveStr = `${piece.type[0].toUpperCase()}${String.fromCharCode(97 + startCol)}${BOARD_SIZE - startRow}->${String.fromCharCode(97 + targetCol)}${BOARD_SIZE - targetRow}${isCheck ? '+' : ''}`;

    const nextState: GameState & { isCheck: boolean } = {
      ...gameState,
      board: nextBoard,
      turn: nextTurn,
      selectedPiece: null,
      validMoves: [],
      history: [moveStr, ...gameState.history],
      isGameOver,
      winner,
      isCheck
    };

    setGameState(nextState);
    connRef.current?.send({ type: 'MOVE', state: nextState });
  };

  const resetGame = () => {
    const newState: GameState & { isCheck: boolean } = {
      board: initialPieces(),
      turn: 'white',
      selectedPiece: null,
      validMoves: [],
      history: [],
      isGameOver: false,
      winner: null,
      isCheck: false
    };
    setGameState(newState);
    connRef.current?.send({ type: 'RESET', state: newState });
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('تم نسخ رابط الدعوة!');
  };

  const kingInCheckPos = useMemo(() => 
    gameState.isCheck ? findKing(gameState.turn, gameState.board) : null
  , [gameState.isCheck, gameState.turn, gameState.board]);

  return (
    <div className="h-screen w-screen flex flex-col items-center bg-slate-950 text-right overflow-hidden p-2 md:p-4 touch-none">
      
      {/* Mini Status Header */}
      <div className="w-full max-w-lg flex items-center justify-between gap-2 mb-2 p-3 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-lg">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full animate-pulse ${connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span className="text-[10px] font-black text-slate-400">
            {connectionStatus === 'connected' ? 'أونلاين' : 'انتظار...'}
          </span>
          <div className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${myColor === 'white' ? 'bg-white text-black' : 'bg-amber-600 text-white'}`}>
            {myColor === 'white' ? 'أبيض' : 'أسود'}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={copyInviteLink} className="p-2 bg-indigo-600 rounded-xl text-white shadow-md">
            <UI_ICONS.History size={14} />
          </button>
          <button onClick={resetGame} className="p-2 bg-slate-800 rounded-xl text-amber-500 border border-slate-700">
            <UI_ICONS.RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Main Container - Adjusted for "One View" */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg gap-4">
        
        {/* Turn Indicator */}
        <div className="w-full flex justify-between items-center px-2">
          <div className={`flex items-center flex-row-reverse gap-3 p-2 rounded-xl border ${gameState.turn === 'white' ? 'bg-white/10 border-white/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
            <div className={`w-5 h-5 rounded-full border ${gameState.turn === 'white' ? 'bg-white' : 'bg-black border-amber-600'}`} />
            <span className="text-xs font-bold text-slate-200">دور {gameState.turn === 'white' ? 'الأبيض' : 'الأسود'}</span>
          </div>
          {gameState.isCheck && !gameState.isGameOver && (
            <div className="text-red-500 text-xs font-black animate-bounce">⚠️ كش ملك!</div>
          )}
        </div>

        {/* The Board - Sized for Mobile */}
        <div className="relative p-2 bg-slate-900 rounded-[30px] shadow-2xl border-4 border-slate-800">
          <div className={`chess-board w-[90vw] h-[90vw] max-w-[450px] max-h-[450px] gap-1 ${myColor === 'black' ? 'rotate-180' : ''}`}>
            {gameState.board.map((row, rIdx) => 
              row.map((piece, cIdx) => {
                const isSelected = gameState.selectedPiece?.position[0] === rIdx && gameState.selectedPiece?.position[1] === cIdx;
                const isValidMoveCandidate = gameState.validMoves.some(([r, c]) => r === rIdx && c === cIdx);
                const isKingCheckHighlight = kingInCheckPos?.[0] === rIdx && kingInCheckPos?.[1] === cIdx;
                
                return (
                  <div 
                    key={`${rIdx}-${cIdx}`}
                    onClick={() => handleCellClick(rIdx, cIdx)}
                    className={`
                      relative flex items-center justify-center cursor-pointer aspect-square rounded-full transition-all duration-150
                      ${(rIdx + cIdx) % 2 === 0 ? 'bg-slate-800/60' : 'bg-slate-900'}
                      ${isSelected ? 'ring-2 ring-amber-500 bg-amber-500/20 z-10' : ''}
                      ${isKingCheckHighlight ? 'bg-red-500/40 ring-2 ring-red-500' : ''}
                      ${isValidMoveCandidate ? 'bg-emerald-500/20 after:content-[""] after:w-1.5 after:h-1.5 after:bg-emerald-500 after:rounded-full' : ''}
                    `}
                  >
                    {piece && (
                      <div className={`
                        relative w-[85%] h-[85%] rounded-full shadow-lg flex items-center justify-center ${myColor === 'black' ? 'rotate-180' : ''}
                        ${piece.color === 'white' 
                          ? 'bg-gradient-to-br from-white to-slate-200 text-slate-900' 
                          : 'bg-gradient-to-br from-slate-700 to-black text-amber-500'}
                      `}>
                        {(() => {
                          const IconComponent = PieceIcons[piece.type];
                          return <IconComponent className="w-1/2 h-1/2" />;
                        })()}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Compact Move History & Opponent Wait */}
        <div className="w-full flex flex-col gap-2">
           {gameState.turn !== myColor && !gameState.isGameOver && (
              <div className="text-center text-[10px] text-slate-500 font-bold animate-pulse">جاري تفكير الخصم...</div>
           )}
           <div className="flex flex-row-reverse gap-2 overflow-x-auto pb-2 custom-scrollbar">
             {gameState.history.slice(0, 5).map((move, i) => (
                <div key={i} className="whitespace-nowrap bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700 text-[10px] font-mono text-slate-400">
                  <span className="text-amber-500 font-bold ml-1">{gameState.history.length - i}.</span> {move}
                </div>
             ))}
             {gameState.history.length === 0 && <span className="text-[10px] text-slate-700 w-full text-center">لا توجد حركات بعد</span>}
           </div>
        </div>
      </div>

      {/* Game Over Modal */}
      {gameState.isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-6">
          <div className="bg-slate-900 p-8 rounded-[40px] border-2 border-amber-500 shadow-2xl w-full max-w-xs text-center">
            <UI_ICONS.Trophy size={60} className="mx-auto text-amber-500 mb-4 animate-bounce" />
            <h2 className="text-2xl font-black text-white mb-2">{gameState.winner === 'draw' ? 'تعادل' : 'فوز ساحق!'}</h2>
            <p className="text-lg text-amber-400 font-bold mb-6">
               {gameState.winner === 'draw' ? 'انتهى النزال بالتعادل' : `بطل الميدان: ${gameState.winner === 'white' ? 'الأبيض' : 'الأسود'}`}
            </p>
            <button onClick={resetGame} className="w-full bg-amber-500 text-slate-950 font-black py-4 rounded-2xl shadow-xl">نزال جديد</button>
          </div>
        </div>
      )}

      <style>{`
        .chess-board { display: grid; grid-template-columns: repeat(10, 1fr); }
        .custom-scrollbar::-webkit-scrollbar { height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
