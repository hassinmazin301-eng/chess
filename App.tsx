
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
    
    // We use a random ID if we can't get one from PeerJS immediately to avoid delays
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
        const shortId = id;
        setRoomId(shortId);
        setMyColor('white');
        setConnectionStatus('waiting');
        
        // Use try-catch for pushState to avoid SecurityError in blob/sandboxed environments
        try {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('room', shortId);
          window.history.pushState({}, '', newUrl.toString());
        } catch (e) {
          console.warn('Failed to update URL via pushState:', e);
          // Fallback: stay on current URL, the "Copy Link" button will still work
        }
      }
    });

    peer.on('connection', (conn: any) => {
      if (!connRef.current) {
        setupConnection(conn);
        setConnectionStatus('connected');
      }
    });

    peer.on('error', (err: any) => {
      console.error('PeerJS error:', err);
      setConnectionStatus('error');
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
    // Construct a clean URL for sharing, even if current is a blob
    let shareUrl = window.location.href;
    try {
      const url = new URL(window.location.href);
      if (roomId) url.searchParams.set('room', roomId);
      shareUrl = url.toString();
    } catch (e) {
      // If blob URL makes URL constructor fail, we use a simpler approach
      if (roomId && !shareUrl.includes('room=')) {
        shareUrl += (shareUrl.includes('?') ? '&' : '?') + 'room=' + roomId;
      }
    }
    
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('تم نسخ رابط الدعوة بنجاح! أرسله للخصم.');
    }).catch(() => {
      alert('الرابط: ' + shareUrl);
    });
  };

  const kingInCheckPos = useMemo(() => 
    gameState.isCheck ? findKing(gameState.turn, gameState.board) : null
  , [gameState.isCheck, gameState.turn, gameState.board]);

  return (
    <div className="h-screen w-screen flex flex-col items-center bg-slate-950 text-right overflow-hidden touch-none">
      
      {/* Dynamic Header - Optimized for Mobile Height */}
      <div className="w-full flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md z-20">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-amber-500 animate-pulse'}`} />
          <span className="text-[10px] font-black text-slate-400">
            {connectionStatus === 'connected' ? 'أونلاين' : 'انتظار...'}
          </span>
          <div className={`px-2 py-0.5 rounded-md text-[10px] font-black ${myColor === 'white' ? 'bg-white text-black' : 'bg-amber-600 text-white'}`}>
            {myColor === 'white' ? 'أنت الأبيض' : 'أنت الأسود'}
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={copyInviteLink} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white shadow-md text-[10px] font-bold transition-all"
          >
            <UI_ICONS.History size={12} />
            <span>دعوة</span>
          </button>
          <button 
            onClick={resetGame} 
            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-amber-500 border border-slate-700 transition-all"
          >
            <UI_ICONS.RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Main Content Area - Full screen flex container */}
      <div className="flex-1 flex flex-col items-center justify-between w-full p-2 max-w-lg mx-auto overflow-hidden">
        
        {/* Top Info Bar */}
        <div className="w-full flex justify-between items-center px-2 py-1">
          <div className={`flex items-center flex-row-reverse gap-3 px-3 py-1.5 rounded-xl border-2 transition-all ${
            gameState.turn === 'white' ? 'bg-white/5 border-white/20' : 'bg-amber-500/5 border-amber-500/20'
          }`}>
            <div className={`w-4 h-4 rounded-full border shadow-sm ${gameState.turn === 'white' ? 'bg-white' : 'bg-black border-amber-600'}`} />
            <span className="text-xs font-black text-slate-100">دور {gameState.turn === 'white' ? 'الأبيض' : 'الأسود'}</span>
          </div>
          {gameState.isCheck && !gameState.isGameOver && (
            <div className="px-3 py-1 bg-red-500/20 border border-red-500/40 rounded-lg text-red-500 text-[10px] font-black animate-bounce shadow-lg">
              ⚠️ كش ملك!
            </div>
          )}
        </div>

        {/* The Board - Square centered container */}
        <div className="relative flex items-center justify-center w-full aspect-square max-w-[min(90vw,480px)]">
          <div className="absolute inset-0 bg-slate-800/20 rounded-[40px] blur-2xl -z-10" />
          <div className="p-1.5 bg-slate-900 rounded-[35px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-4 border-slate-800">
            <div className={`chess-board w-[82vw] h-[82vw] max-w-[420px] max-h-[420px] gap-1 ${myColor === 'black' ? 'rotate-180' : ''}`}>
              {gameState.board.map((row, rIdx) => 
                row.map((piece, cIdx) => {
                  const isSelected = gameState.selectedPiece?.position[0] === rIdx && gameState.selectedPiece?.position[1] === cIdx;
                  const isValidMoveCandidate = gameState.validMoves.some(([r, c]) => r === rIdx && c === cIdx);
                  const isKingCheckHighlight = kingInCheckPos?.[0] === rIdx && kingInCheckPos?.[1] === cIdx;
                  const isEven = (rIdx + cIdx) % 2 === 0;
                  
                  return (
                    <div 
                      key={`${rIdx}-${cIdx}`}
                      onClick={() => handleCellClick(rIdx, cIdx)}
                      className={`
                        relative flex items-center justify-center cursor-pointer aspect-square rounded-full transition-all duration-150
                        ${isEven ? 'bg-slate-800/40' : 'bg-slate-900/60'}
                        ${isSelected ? 'ring-2 ring-amber-500 bg-amber-500/20 z-10 scale-105 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : ''}
                        ${isKingCheckHighlight ? 'bg-red-500/30 ring-2 ring-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : ''}
                        ${isValidMoveCandidate ? 'bg-emerald-500/20 after:content-[""] after:w-1.5 after:h-1.5 after:bg-emerald-500 after:rounded-full after:animate-pulse' : ''}
                      `}
                    >
                      {piece && (
                        <div className={`
                          relative w-[85%] h-[85%] rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-90 ${myColor === 'black' ? 'rotate-180' : ''}
                          ${piece.color === 'white' 
                            ? 'bg-gradient-to-br from-white to-slate-200 text-slate-900 border border-slate-300' 
                            : 'bg-gradient-to-br from-slate-700 to-black text-amber-500 border border-slate-800'}
                        `}>
                          {(() => {
                            const IconComponent = PieceIcons[piece.type];
                            return <IconComponent className="w-[55%] h-[55%] drop-shadow-sm" />;
                          })()}
                          <div className="absolute top-[10%] left-[15%] w-1/4 h-1/5 bg-white/20 rounded-full blur-[1px] rotate-[-15deg]" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Bottom Panel - History & Status */}
        <div className="w-full flex flex-col gap-2 pb-4">
           {gameState.turn !== myColor && !gameState.isGameOver && (
              <div className="text-center text-[10px] text-indigo-400 font-bold animate-pulse">بانتظار حركة الخصم...</div>
           )}
           <div className="flex flex-row-reverse gap-2 overflow-x-auto pb-1 px-2 custom-scrollbar no-scrollbar">
             {gameState.history.length === 0 ? (
               <div className="w-full py-2 text-center text-[10px] text-slate-700 font-bold italic">لا توجد حركات في السجل</div>
             ) : (
               gameState.history.slice(0, 8).map((move, i) => (
                <div key={i} className="whitespace-nowrap bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-800/50 text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                  <span className="text-amber-500/60 font-black">#{gameState.history.length - i}</span>
                  <span className="text-slate-200">{move}</span>
                </div>
               ))
             )}
           </div>
        </div>
      </div>

      {/* Game Over Modal */}
      {gameState.isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-6 transition-all">
          <div className="bg-slate-900 p-8 rounded-[40px] border-2 border-amber-500 shadow-[0_0_50px_rgba(245,158,11,0.2)] w-full max-w-xs text-center transform scale-110">
            <div className="mb-4 relative">
              <UI_ICONS.Trophy size={64} className="mx-auto text-amber-500 animate-bounce" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-amber-500/20 blur-2xl -z-10 rounded-full" />
            </div>
            <h2 className="text-3xl font-black text-white mb-1">{gameState.winner === 'draw' ? 'تعادل' : 'كش مات!'}</h2>
            <p className="text-lg text-amber-400 font-bold mb-8">
               {gameState.winner === 'draw' ? 'انتهى النزال بالتعادل' : `بطل الميدان: ${gameState.winner === 'white' ? 'الأبيض' : 'الأسود'}`}
            </p>
            <button 
              onClick={resetGame} 
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-transform"
            >
              نزال جديد
            </button>
          </div>
        </div>
      )}

      <style>{`
        .chess-board { display: grid; grid-template-columns: repeat(10, 1fr); }
        .custom-scrollbar::-webkit-scrollbar { height: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;
