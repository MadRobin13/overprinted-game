import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Printer, Zap, Award, Clock, Heart } from 'lucide-react';

// Game runs until you miss an order

const FILAMENTS = {
  'PLA': { strength: 'Low', color: 'bg-green-500' },
  'PETG': { strength: 'Medium', color: 'bg-blue-500' },
  'ABS': { strength: 'High', color: 'bg-red-500' },
  'TPU': { strength: 'Flexible', color: 'bg-purple-500' }
};

const COLORS = ['Red', 'Blue', 'Green', 'Yellow', 'Black', 'White'];

const COLOR_CLASSES = {
  'Red': 'bg-red-400',
  'Blue': 'bg-blue-400',
  'Green': 'bg-green-400',
  'Yellow': 'bg-yellow-400',
  'Black': 'bg-gray-800',
  'White': 'bg-gray-100'
};

const REQUIREMENTS = [
  { type: 'strength', label: 'Strength', values: ['Low', 'Medium', 'High', 'Flexible'] },
  { type: 'color', label: 'Color', values: COLORS }
];

const generateOrder = (id, difficulty) => {
  // Determine order complexity based on difficulty
  const hasMultipleRequirements = difficulty > 20 && Math.random() < 0.4; // 40% chance after difficulty 20
  const requirements = [];
  let selectedFilaments = [];
  let selectedColors = [];
  
  if (hasMultipleRequirements) {
    // Multi-requirement order
    const numFilaments = Math.random() < 0.6 ? 2 : 3; // 60% chance for 2, 40% chance for 3
    const filamentTypes = Object.keys(FILAMENTS);
    
    // Select multiple filaments
    for (let i = 0; i < numFilaments; i++) {
      let filament;
      do {
        filament = filamentTypes[Math.floor(Math.random() * filamentTypes.length)];
      } while (selectedFilaments.some(f => f.correctFilament === filament));
      
      selectedFilaments.push({
        type: 'strength',
        value: FILAMENTS[filament].strength,
        correctFilament: filament
      });
    }
    
    // Add to requirements
    requirements.push({
      type: 'multi-strength',
      values: selectedFilaments.map(f => f.value),
      correctFilaments: selectedFilaments.map(f => f.correctFilament),
      label: 'Strengths'
    });
    
    // Sometimes also add multiple colors
    if (Math.random() < 0.7) {
      const numColors = Math.min(numFilaments, 2); // Max 2 colors
      for (let i = 0; i < numColors; i++) {
        let color;
        do {
          color = COLORS[Math.floor(Math.random() * COLORS.length)];
        } while (selectedColors.includes(color));
        selectedColors.push(color);
      }
      
      requirements.push({
        type: 'multi-color',
        values: selectedColors,
        label: 'Colors'
      });
    }
  } else {
    // Single requirement order (existing logic)
    const strengthType = Object.keys(FILAMENTS)[Math.floor(Math.random() * Object.keys(FILAMENTS).length)];
    requirements.push({
      type: 'strength',
      value: FILAMENTS[strengthType].strength,
      correctFilament: strengthType
    });
    selectedFilaments = [strengthType];
    
    // Add color requirement if difficulty allows
    if (difficulty > 10 && Math.random() < 0.6) {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      requirements.push({
        type: 'color',
        value: color
      });
      selectedColors = [color];
    }
  }
  
  // Calculate time limit based on difficulty and complexity
  const baseTime = hasMultipleRequirements ? 45000 : 30000; // More time for complex orders
  const timePenalty = Math.min(15000, difficulty * 100);
  const timeLimit = baseTime - timePenalty;
  
  return {
    id,
    requirements,
    currentStep: 0,
    timeLimit: Math.max(20000, timeLimit), // Min 20 seconds for complex orders
    createdAt: Date.now(),
    selectedFilaments: [],
    selectedColors: [],
    isMultiRequirement: hasMultipleRequirements
  };
};

export default function PrintShopRush() {
  const [gameState, setGameState] = useState('menu'); // menu, playing, ended
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [score, setScore] = useState(0);
  const [nextOrderId, setNextOrderId] = useState(1);
  const [feedback, setFeedback] = useState('');
  const [difficulty, setDifficulty] = useState(0);
  const [hearts, setHearts] = useState(3);
  
  const difficultyRef = useRef(0);
  const nextOrderIdRef = useRef(1);

  const startGame = () => {
    setGameState('playing');
    setOrders([]);
    setActiveOrder(null);
    setScore(0);
    setNextOrderId(1);
    setFeedback('');
    setDifficulty(0);
    setHearts(3);
    difficultyRef.current = 0;
    nextOrderIdRef.current = 1;
  };

  const endGame = () => {
    setGameState('ended');
  };

  // Update refs when state changes
  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);
  
  useEffect(() => {
    nextOrderIdRef.current = nextOrderId;
  }, [nextOrderId]);

  // Spawn orders - gets faster as difficulty increases
  useEffect(() => {
    if (gameState !== 'playing') return;

    const spawnOrder = () => {
      const newOrder = generateOrder(nextOrderIdRef.current, difficultyRef.current);
      setOrders(prev => [...prev, newOrder]);
      setNextOrderId(prev => prev + 1);
    };

    // Spawn first order immediately
    spawnOrder();

    // Gentler dynamic spawn rate progression
    const baseSpawnRate = 3000; // 3 seconds initially
    const difficultyReduction = Math.min(1500, difficultyRef.current * 5); // More gradual reduction
    const spawnRate = Math.max(1000, baseSpawnRate - difficultyReduction); // Minimum 1 second
    
    const interval = setInterval(spawnOrder, spawnRate);
    return () => clearInterval(interval);
  }, [gameState]);

  // Game timer removed - game runs until you miss an order

  // Increase difficulty over time - gentler progression
  useEffect(() => {
    if (gameState !== 'playing') return;

    const difficultyTimer = setInterval(() => {
      setDifficulty(prev => {
        const newDifficulty = prev + 1;
        difficultyRef.current = newDifficulty;
        return newDifficulty;
      });
    }, 2000); // Increase every 2 seconds for gentler progression

    return () => clearInterval(difficultyTimer);
  }, [gameState]);

  // Check for expired orders
  useEffect(() => {
    if (gameState !== 'playing') return;

    const checkExpired = setInterval(() => {
      const now = Date.now();
      setOrders(prev => {
        const expired = prev.filter(order => now - order.createdAt > order.timeLimit);
        if (expired.length > 0) {
          // Lose a heart for missed order
          setHearts(currentHearts => {
            const newHearts = currentHearts - 1;
            if (newHearts <= 0) {
              endGame();
            }
            return newHearts;
          });
          setFeedback('Order missed! -1 heart');
          setTimeout(() => setFeedback(''), 1500);
          // Remove expired orders
          return prev.filter(order => now - order.createdAt <= order.timeLimit);
        }
        return prev;
      });
    }, 100);

    return () => clearInterval(checkExpired);
  }, [gameState]);

  const selectOrder = (order) => {
    if (activeOrder?.id === order.id) return;
    setActiveOrder(order);
  };

  const selectFilament = (filament) => {
    if (!activeOrder) {
      setFeedback('Select an order first!');
      setTimeout(() => setFeedback(''), 1500);
      return;
    }

    let updatedOrder;
    if (activeOrder.isMultiRequirement) {
      // Multi-requirement order - toggle filament selection
      const currentSelected = activeOrder.selectedFilaments || [];
      let newSelected;
      
      if (currentSelected.includes(filament)) {
        // Remove if already selected
        newSelected = currentSelected.filter(f => f !== filament);
      } else {
        // Add if not selected
        newSelected = [...currentSelected, filament];
      }
      
      updatedOrder = { ...activeOrder, selectedFilaments: newSelected };
    } else {
      // Single requirement order
      updatedOrder = { ...activeOrder, selectedFilament: filament };
    }
    
    setActiveOrder(updatedOrder);
    setOrders(prev => prev.map(o => 
      o.id === updatedOrder.id ? updatedOrder : o
    ));
    
    checkOrderCompletion(updatedOrder);
  };

  const selectColor = (color) => {
    if (!activeOrder) {
      setFeedback('Select an order first!');
      setTimeout(() => setFeedback(''), 1500);
      return;
    }

    let updatedOrder;
    if (activeOrder.isMultiRequirement && activeOrder.requirements.some(r => r.type === 'multi-color')) {
      // Multi-color requirement - toggle color selection
      const currentSelected = activeOrder.selectedColors || [];
      let newSelected;
      
      if (currentSelected.includes(color)) {
        // Remove if already selected
        newSelected = currentSelected.filter(c => c !== color);
      } else {
        // Add if not selected
        newSelected = [...currentSelected, color];
      }
      
      updatedOrder = { ...activeOrder, selectedColors: newSelected };
    } else {
      // Single color requirement
      updatedOrder = { ...activeOrder, selectedColor: color };
    }
    
    setActiveOrder(updatedOrder);
    setOrders(prev => prev.map(o => 
      o.id === updatedOrder.id ? updatedOrder : o
    ));
    
    checkOrderCompletion(updatedOrder);
  };

  const checkOrderCompletion = (order) => {
    if (order.isMultiRequirement) {
      // Multi-requirement order logic
      const multiStrengthReq = order.requirements.find(r => r.type === 'multi-strength');
      const multiColorReq = order.requirements.find(r => r.type === 'multi-color');
      
      const selectedFilaments = order.selectedFilaments || [];
      const selectedColors = order.selectedColors || [];
      
      // Check if all filaments are selected
      const allFilamentsSelected = multiStrengthReq ? 
        selectedFilaments.length === multiStrengthReq.correctFilaments.length : true;
      
      // Check if all colors are selected (if required)
      const allColorsSelected = multiColorReq ? 
        selectedColors.length === multiColorReq.values.length : true;
      
      if (allFilamentsSelected && allColorsSelected) {
        // Check if selections match requirements
        const filamentsMatch = multiStrengthReq ? 
          multiStrengthReq.correctFilaments.every(f => selectedFilaments.includes(f)) : true;
        
        const colorsMatch = multiColorReq ? 
          multiColorReq.values.every(c => selectedColors.includes(c)) : true;
        
        if (filamentsMatch && colorsMatch) {
          // Perfect complex order! More points
          const bonus = order.requirements.length * 15;
          setScore(prev => prev + 25 + bonus);
          setFeedback(`Perfect complex print! +${25 + bonus} points`);
          setTimeout(() => setFeedback(''), 2000);
          setOrders(prev => prev.filter(o => o.id !== order.id));
          setActiveOrder(null);
        } else {
          // Wrong selection
          setHearts(currentHearts => {
            const newHearts = currentHearts - 1;
            if (newHearts <= 0) {
              endGame();
            }
            return newHearts;
          });
          setFeedback('Wrong materials! -1 heart');
          setTimeout(() => setFeedback(''), 1500);
          setOrders(prev => prev.filter(o => o.id !== order.id));
          setActiveOrder(null);
        }
      }
    } else {
      // Single requirement order logic (existing)
      const strengthReq = order.requirements.find(r => r.type === 'strength');
      const colorReq = order.requirements.find(r => r.type === 'color');

      const strengthMatch = !strengthReq || order.selectedFilament === strengthReq.correctFilament;
      const colorMatch = !colorReq || order.selectedColor === colorReq.value;

      const allSelected = order.selectedFilament && (!colorReq || order.selectedColor);

      if (allSelected) {
        if (strengthMatch && colorMatch) {
          // Perfect order!
          setScore(prev => prev + 25);
          setFeedback('Perfect print! +25 points');
          setTimeout(() => setFeedback(''), 1500);
          setOrders(prev => prev.filter(o => o.id !== order.id));
          setActiveOrder(null);
        } else {
          // Wrong selection - lose a heart!
          setHearts(currentHearts => {
            const newHearts = currentHearts - 1;
            if (newHearts <= 0) {
              endGame();
            }
            return newHearts;
          });
          setFeedback('Wrong materials! -1 heart');
          setTimeout(() => setFeedback(''), 1500);
          setOrders(prev => prev.filter(o => o.id !== order.id));
          setActiveOrder(null);
        }
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeProgress = (order) => {
    const elapsed = Date.now() - order.createdAt;
    return Math.min(100, (elapsed / order.timeLimit) * 100);
  };

  const getProgressColor = (progress) => {
    if (progress < 50) return 'bg-green-500';
    if (progress < 75) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (gameState === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-8 max-w-md w-full text-center">
          <div className="flex justify-center mb-3 sm:mb-4">
            <Printer className="w-16 h-16 sm:w-20 sm:h-20 text-blue-500" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-800 mb-3 sm:mb-4">Print Shop Rush</h1>
          <p className="text-sm sm:text-base text-slate-600 mb-4 sm:mb-6">
            Run a 3D printing shop! Choose the right filament and color to match customer requirements before they get angry!
          </p>
          <div className="bg-slate-100 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 text-left">
            <h3 className="font-semibold text-slate-800 mb-2 text-sm sm:text-base">How to Play:</h3>
            <ul className="text-xs sm:text-sm text-slate-600 space-y-1 mb-3">
              <li>• Tap an order to select it</li>
              <li>• Choose the correct filament type for the required strength</li>
              <li>• If color is required, select the matching color</li>
              <li>• Complex orders may need multiple filaments or colors!</li>
              <li>• Complete orders before they expire or you'll lose a heart</li>
              <li>• Wrong materials also cost you a heart</li>
              <li>• Game ends when you lose all 3 hearts</li>
              <li>• Regular orders: +25 points, Complex orders: bonus points!</li>
            </ul>
            <div className="text-xs text-slate-500 border-t border-slate-200 pt-2">
              <strong>Filament Guide:</strong> PLA=Low, PETG=Medium, ABS=High, TPU=Flexible
            </div>
          </div>
          <button
            onClick={startGame}
            className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-bold py-3 px-6 sm:px-8 rounded-lg transition-colors touch-manipulation"
          >
            Start Game
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'ended') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-8 max-w-md w-full text-center">
          <Award className="w-16 h-16 sm:w-20 sm:h-20 text-yellow-500 mx-auto mb-3 sm:mb-4" />
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-800 mb-2">You Lose!</h1>
          <p className="text-sm sm:text-base text-slate-600 mb-2">Final Score</p>
          <p className="text-4xl sm:text-6xl font-bold text-blue-500 mb-4 sm:mb-6">{score}</p>
          <p className="text-sm sm:text-base text-slate-500 mb-4 sm:mb-6">
            {score === 0 ? "Better luck next time!" : 
             score < 100 ? "Keep practicing!" :
             score < 250 ? "Good job!" :
             score < 500 ? "Excellent work!" :
             "Amazing performance!"}
          </p>
          <button
            onClick={startGame}
            className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-bold py-3 px-6 sm:px-8 rounded-lg transition-colors touch-manipulation"
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-2 sm:p-4 pb-safe">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-3 sm:mb-6">
        <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 flex justify-between items-center">
          <div className="flex items-center gap-1 sm:gap-2">
            <Award className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
            <span className="text-xl sm:text-2xl font-bold text-slate-800">{score}</span>
            <span className="text-sm sm:text-base text-slate-600">points</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {[...Array(3)].map((_, i) => (
              <Heart
                key={i}
                className={`w-5 h-5 sm:w-6 sm:h-6 ${
                  i < hearts ? 'text-red-500 fill-red-500' : 'text-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Orders Queue */}
      <div className="max-w-6xl mx-auto mb-3 sm:mb-6">
        <h2 className="text-white text-lg sm:text-xl font-semibold mb-2 sm:mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
          Customer Orders
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 max-h-60 sm:max-h-none overflow-y-auto">
          {orders.map(order => {
            const timeProgress = getTimeProgress(order);
            return (
              <div
                key={order.id}
                onClick={() => selectOrder(order)}
                className={`bg-white rounded-lg shadow-lg p-3 sm:p-4 cursor-pointer transition-all touch-manipulation ${
                  activeOrder?.id === order.id ? 'ring-2 sm:ring-4 ring-blue-500 scale-105' : 'active:scale-95'
                }`}
              >
                <div className="flex justify-between items-center mb-2 sm:mb-3">
                  <span className="font-bold text-sm sm:text-base text-slate-800">Order #{order.id}</span>
                  <span className="text-xs text-slate-500">
                    {order.requirements.length} req
                  </span>
                </div>
                <div className="space-y-1 sm:space-y-2 mb-2 sm:mb-3">
                  {order.requirements.map((req, idx) => (
                    <div key={idx} className="bg-slate-50 rounded p-1.5 sm:p-2">
                      <div className="text-xs text-slate-500">{req.label || req.type}</div>
                      {req.type === 'multi-strength' ? (
                        <div className="font-semibold text-sm sm:text-base text-slate-800">
                          {req.values.join(', ')}
                        </div>
                      ) : req.type === 'multi-color' ? (
                        <div className="font-semibold text-sm sm:text-base text-slate-800">
                          {req.values.join(', ')}
                        </div>
                      ) : (
                        <div className="font-semibold text-sm sm:text-base text-slate-800">{req.value}</div>
                      )}
                    </div>
                  ))}
                </div>
                {(order.selectedFilament || order.selectedFilaments?.length > 0 || order.selectedColor || order.selectedColors?.length > 0) && (
                  <div className="text-xs text-blue-600 mb-1 sm:mb-2">
                    Selected: 
                    {order.isMultiRequirement ? (
                      <>
                        {order.selectedFilaments?.length > 0 && ` ${order.selectedFilaments.join(', ')}`}
                        {order.selectedColors?.length > 0 && ` • ${order.selectedColors.join(', ')}`}
                      </>
                    ) : (
                      <>
                        {order.selectedFilament && order.selectedFilament}
                        {order.selectedColor && ` • ${order.selectedColor}`}
                      </>
                    )}
                  </div>
                )}
                <div className="text-xs text-slate-500 mb-1">Customer Patience:</div>
                <div className="h-2 sm:h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${getProgressColor(timeProgress)}`}
                    style={{ width: `${timeProgress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Printer Panel */}
      <div className="max-w-6xl mx-auto mb-3 sm:mb-6">
        <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <Printer className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
              <h2 className="text-lg sm:text-2xl font-bold text-slate-800">Active Print</h2>
            </div>
            {feedback && (
              <div className={`px-2 sm:px-4 py-1 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm ${
                feedback.includes('+') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {feedback}
              </div>
            )}
          </div>
          {activeOrder ? (
            <div className="bg-slate-50 rounded-lg p-3 sm:p-6">
              <div className="flex justify-between items-center mb-3 sm:mb-4">
                <span className="text-base sm:text-lg font-semibold text-slate-800">
                  Order #{activeOrder.id}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                {activeOrder.requirements.map((req, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-slate-500 mb-1">Required:</div>
                    {req.type === 'multi-strength' ? (
                      <div className="text-lg sm:text-xl font-bold text-blue-600">
                        {req.values.join(', ')}
                      </div>
                    ) : req.type === 'multi-color' ? (
                      <div className="text-lg sm:text-xl font-bold text-blue-600">
                        {req.values.join(', ')}
                      </div>
                    ) : (
                      <div className="text-lg sm:text-xl font-bold text-blue-600">{req.value}</div>
                    )}
                    <div className="text-xs text-slate-400 mt-1">({req.label || req.type})</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg p-4 sm:p-6 text-center text-slate-500">
              <span className="text-sm sm:text-base">Tap an order to begin printing</span>
            </div>
          )}
        </div>
      </div>

      {/* Material Selection */}
      <div className="max-w-6xl mx-auto">
        <h2 className="text-white text-lg sm:text-xl font-semibold mb-2 sm:mb-3">Filament Types</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          {Object.entries(FILAMENTS).map(([filament, props]) => (
            <button
              key={filament}
              onClick={() => selectFilament(filament)}
              className={`${props.color} active:opacity-75 text-white font-bold py-4 sm:py-6 rounded-lg transition-all transform active:scale-95 shadow-lg touch-manipulation ${
                (activeOrder?.selectedFilament === filament || activeOrder?.selectedFilaments?.includes(filament)) ? 'ring-2 sm:ring-4 ring-white' : ''
              }`}
            >
              <div className="text-sm sm:text-lg">{filament}</div>
              <div className="text-xs sm:text-sm opacity-90">{props.strength}</div>
            </button>
          ))}
        </div>

        <h2 className="text-white text-lg sm:text-xl font-semibold mb-2 sm:mb-3">Color Options</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-4">
          {COLORS.map(color => (
            <button
              key={color}
              onClick={() => selectColor(color)}
              className={`${COLOR_CLASSES[color]} active:opacity-75 font-bold py-4 sm:py-6 rounded-lg transition-all transform active:scale-95 shadow-lg touch-manipulation ${
                (activeOrder?.selectedColor === color || activeOrder?.selectedColors?.includes(color)) ? 'ring-2 sm:ring-4 ring-white' : ''
              } ${color === 'White' ? 'text-slate-800 border-2 border-slate-300' : 'text-white'}`}
            >
              <span className="text-sm sm:text-base">{color}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}