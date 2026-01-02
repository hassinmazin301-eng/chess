
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Color, Piece, PieceType, GameState } from './types.ts';
import { PieceIcons, UI_ICONS } from './constants.tsx';
import { 
  getLegalMoves, 
  isKingInCheck, 
  hasAnyLegalMoves, 
  simulateMove,
  findKing 
} from './utils/moveLogic.ts';

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
  const [isLoading, setIsLoading] = useState(true);
  
  const peerRef = useRef<any>(null);
  const connRef = useRef<any>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    
    // تأمين ظهور اللعبة حتى لو فشل الاتصال بعد 5 ثواني
    const timeout = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        if (!myColor) setMyColor('white');
      }
    }, 5000);

    try {
      if (typeof Peer === 'undefined') {
         setIsLoading(false);
         setMyColor('white');
         return;
      }

      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', (id: string) => {
        clearTimeout(timeout);
        setIsLoading(false);
        if (roomFromUrl) {
          setRoomId(roomFromUrl);
          setMyColor('black');
          setConnectionStatus('waiting');
          const conn = peer.connect(roomFromUrl);
          setupConnection(conn);
        } else {
          setRoomId(id);
          setMyColor('white');
          setConnectionStatus('waiting');
          
          try {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('room', id);
            window.history.pushState({}, '', newUrl.toString());
          } catch (e) { console.warn(e); }
        }
      });

      peer.on('connection', (conn: any) => {
        if (!connRef.current) {
          setupConnection(conn);
          setConnectionStatus('connected');
        }
      });

      peer.on('error', (err: any) => {
        setConnectionStatus('error');
        setIsLoading(false);
        if (!myColor) setMyColor('white');
      });
    } catch (e) {
      setIsLoading(false);
      setMyColor('white');
    }

    return () => {
      clearTimeout(timeout);
      if (peerRef.current) peerRef.current.destroy();
    };
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
    const canMove = gameState.turn === myColor || connectionStatus === 'idle' || connectionStatus === 'error' || connectionStatus === 'waiting';
    if (gameState.isGameOver || !canMove) return;

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
    if (connRef.current && connRef.current.open) {
      connRef.current.send({ type: 'MOVE', state: nextState });
    }
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
    if (connRef.current && connRef.current.open) {
      connRef.current.send({ type: 'RESET', state: newState });
    }
  };

  const copyInviteLink = () => {
    let shareUrl = window.location.href;
    try {
      const url = new URL(window.location.href);
      if (roomId) url.searchParams.set('room', roomId);
      shareUrl = url.toString();
    } catch (e) {
      if (roomId && !shareUrl.includes('room=')) {
        shareUrl += (shareUrl.includes('?') ? '&' : '?') + 'room=' + roomId;
      }
    }
    
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('تم نسخ الرابط! أرسله لمن تريد أن يلعب معك.');
    });
  };

  const kingInCheckPos = useMemo(() => 
    gameState.isCheck ? findKing(gameState.turn, gameState.board) : null
  , [gameState.isCheck, gameState.turn, gameState.board]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#020617] text-white gap-6">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-amber-500/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div className="flex flex-col items-center gap-2">
           <p className="text-2xl font-black text-amber-500 tracking-widest animate-pulse">شطرنج 10*10</p>
           <p className="text-xs text-slate-500 font-bold">جاري البحث عن اتصال آمن...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-screen flex flex-col items-center bg-slate-950 text-right overflow-hidden touch-none select-none">
      
      {/* Header Panel */}
      <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/95 border-b border-slate-800 backdrop-blur-xl z-20 shadow-xl">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]' : 'bg-amber-500 animate-pulse'}`} />
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400">
              {connectionStatus === 'connected' ? 'متصل بالخصم' : 'بانتظار المنافس...'}
            </span>
            <span className={`text-[11px] font-black ${myColor === 'white' ? 'text-white' : 'text-amber-500'}`}>
              {myColor === 'white' ? 'الجيش الأبيض' : 'الجيش الأسود'}
            </span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={copyInviteLink} 
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white shadow-lg text-xs font-black transition-all active:scale-95"
          >
            <UI_ICONS.History size={14} />
            <span>دعوة</span>
          </button>
          <button 
            onClick={resetGame} 
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-amber-500 border border-slate-700 shadow-md transition-all active:rotate-180"
          >
            <UI_ICONS.RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Game Content */}
      <div className="flex-1 flex flex-col items-center justify-around w-full p-2 max-w-lg mx-auto overflow-hidden">
        
        {/* Turn Status */}
        <div className="w-full flex justify-between items-center px-3">
          <div className={`flex items-center flex-row-reverse gap-3 px-4 py-2 rounded-2xl border-2 transition-all shadow-md ${
            gameState.turn === 'white' ? 'bg-white/5 border-white/20' : 'bg-amber-500/5 border-amber-500/20'
          }`}>
            <div className={`w-5 h-5 rounded-full border-2 shadow-inner ${gameState.turn === 'white' ? 'bg-white border-slate-300' : 'bg-black border-amber-600'}`} />
            <span className="text-sm font-black text-slate-100">دور {gameState.turn === 'white' ? 'الأبيض' : 'الأسود'}</span>
          </div>
          {gameState.isCheck && !gameState.isGameOver && (
            <div className="px-4 py-1.5 bg-red-600/20 border-2 border-red-500/50 rounded-xl text-red-500 text-xs font-black animate-bounce shadow-lg">
              ⚠️ كش ملك!
            </div>
          )}
        </div>

        {/* Board Container */}
        <div className="relative flex items-center justify-center w-full aspect-square max-w-[min(88vw,480px)]">
          <div className="absolute inset-0 bg-amber-500/5 rounded-[40px] blur-3xl -z-10" />
          <div className="p-2 bg-slate-900 rounded-[40px] shadow-[0_25px_60px_rgba(0,0,0,0.6)] border-[6px] border-slate-800">
            <div className={`chess-board w-[80vw] h-[80vw] max-w-[420px] max-h-[420px] gap-1 ${myColor === 'black' ? 'rotate-180' : ''}`}>
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
                        relative flex items-center justify-center cursor-pointer aspect-square rounded-full transition-all duration-200
                        ${isEven ? 'bg-slate-800/40' : 'bg-slate-900/60'}
                        ${isSelected ? 'ring-2 ring-amber-500 bg-amber-500/20 z-10 scale-110 shadow-xl' : ''}
                        ${isKingCheckHighlight ? 'bg-red-500/40 ring-2 ring-red-500 animate-pulse' : ''}
                        ${isValidMoveCandidate ? 'bg-emerald-500/20 after:content-[""] after:w-2 after:h-2 after:bg-emerald-500 after:rounded-full after:shadow-[0_0_10px_rgba(16,185,129,0.8)]' : ''}
                      `}
                    >
                      {piece && (
                        <div className={`
                          relative w-[88%] h-[88%] rounded-full shadow-2xl flex items-center justify-center transition-transform active:scale-90 ${myColor === 'black' ? 'rotate-180' : ''}
                          ${piece.color === 'white' 
                            ? 'bg-gradient-to-br from-white via-slate-100 to-slate-300 text-slate-900 border border-slate-400' 
                            : 'bg-gradient-to-br from-slate-700 via-slate-900 to-black text-amber-500 border border-slate-800 shadow-inner'}
                        `}>
                          {(() => {
                            const IconComponent = PieceIcons[piece.type];
                            return <IconComponent className="w-[55%] h-[55%] drop-shadow-lg" />;
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* History Area */}
        <div className="w-full flex flex-col gap-3 pb-6">
           <div className="flex flex-row-reverse gap-2 overflow-x-auto pb-2 px-4 no-scrollbar">
             {gameState.history.length === 0 ? (
               <div className="w-full text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest py-2">
                 بانتظار الخطوة الأولى...
               </div>
             ) : (
               gameState.history.slice(0, 10).map((move, i) => (
                <div key={i} className="whitespace-nowrap bg-slate-900/80 px-4 py-2.5 rounded-2xl border border-slate-800 shadow-lg text-[11px] font-mono text-slate-300 flex items-center gap-2">
                  <span className="text-amber-500 font-black">#{gameState.history.length - i}</span>
                  <span className="font-bold">{move}</span>
                </div>
               ))
             )}
           </div>
        </div>
      </div>

      {/* Modals */}
      {gameState.isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/98 backdrop-blur-2xl p-6">
          <div className="bg-slate-900 p-10 rounded-[50px] border-2 border-amber-500 shadow-[0_0_80px_rgba(245,158,11,0.25)] w-full max-w-xs text-center">
            <div className="relative mb-6">
              <UI_ICONS.Trophy size={72} className="mx-auto text-amber-500 animate-bounce" />
              <div className="absolute inset-0 bg-amber-500/20 blur-3xl -z-10 rounded-full" />
            </div>
            <h2 className="text-3xl font-black text-white mb-2">{gameState.winner === 'draw' ? 'تعادل عادل' : 'انتصار مجيد!'}</h2>
            <p className="text-lg text-amber-400 font-bold mb-10">
               {gameState.winner === 'draw' ? 'كلاكما محارب عظيم' : `الفوز لـ ${gameState.winner === 'white' ? 'الجيش الأبيض' : 'الجيش الأسود'}`}
            </p>
            <button 
              onClick={resetGame} 
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black py-5 rounded-3xl shadow-2xl active:scale-95 transition-all transform uppercase tracking-tighter"
            >
              بدء نزال جديد
            </button>
          </div>
        </div>
      )}

      <style>{`
        .chess-board { display: grid; grid-template-columns: repeat(10, 1fr); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;
