/* ============================================================
   BLOCK CODING STUDIO — visual programming with real interpreter
   ============================================================ */

// --- Block templates & categories ------------------------------------
const BC_CATEGORIES = [
  { id: 'events',    name: 'Events',      icon: '🟡', color: '#f59e0b' },
  { id: 'output',    name: 'Output',      icon: '🟦', color: '#3b82f6' },
  { id: 'variables', name: 'Variables',   icon: '🟩', color: '#10b981' },
  { id: 'input',     name: 'Input',       icon: '🟧', color: '#f97316' },
  { id: 'math',      name: 'Math',        icon: '🟪', color: '#a855f7' },
  { id: 'logic',     name: 'Logic',       icon: '🟥', color: '#ef4444' },
  { id: 'loops',     name: 'Loops',       icon: '🔵', color: '#06b6d4' },
  { id: 'robot',     name: 'Robot',       icon: '🤖', color: '#8b5cf6' },
];

const BC_BLOCKS = {
  print:  { cat: 'output',    label: 'print', kind: 'stack' },
  set:    { cat: 'variables', label: 'set', kind: 'stack' },
  change: { cat: 'variables', label: 'change', kind: 'stack' },
  ask:    { cat: 'input',     label: 'ask & store', kind: 'stack' },
  if:     { cat: 'logic',     label: 'if', kind: 'container' },
  ifelse: { cat: 'logic',     label: 'if / else', kind: 'container2' },
  repeat: { cat: 'loops',     label: 'repeat', kind: 'container' },
  while:  { cat: 'loops',     label: 'while', kind: 'container' },
  move:   { cat: 'robot',     label: 'move steps', kind: 'stack' },
  turn:   { cat: 'robot',     label: 'turn °', kind: 'stack' },
  pen:    { cat: 'robot',     label: 'pen', kind: 'stack' },
};

let _bcId = 0;
const bcNewId = () => 'b' + (++_bcId) + '-' + Math.random().toString(36).slice(2, 6);

function bcNewBlock(type) {
  const base = { id: bcNewId(), type };
  switch (type) {
    case 'print':  return { ...base, text: '"Hello!"' };
    case 'set':    return { ...base, varName: 'score', value: '0' };
    case 'change': return { ...base, varName: 'score', by: 1 };
    case 'ask':    return { ...base, varName: 'name', prompt: 'What is your name?' };
    case 'if':     return { ...base, condition: { left: 'score', op: '>', right: '0' }, body: [] };
    case 'ifelse': return { ...base, condition: { left: 'score', op: '>=', right: '50' }, body: [], elseBody: [] };
    case 'repeat': return { ...base, times: '5', body: [] };
    case 'while':  return { ...base, condition: { left: 'score', op: '<', right: '10' }, body: [] };
    case 'move':   return { ...base, steps: '10' };
    case 'turn':   return { ...base, degrees: '90' };
    case 'pen':    return { ...base, penDown: true };
  }
}

// --- Safe expression evaluator (no eval / no Function) ---------------
function BlockError(msg) { const e = new Error(msg); e.__block = true; return e; }

function evalBcExpr(raw, vars) {
  const s = String(raw == null ? '' : raw).trim();
  if (s === '') return '';
  if ((s.charAt(0) === '"' && s.charAt(s.length - 1) === '"' && s.length >= 2) ||
      (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'" && s.length >= 2)) {
    return s.slice(1, -1);
  }
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)) {
    if (Object.prototype.hasOwnProperty.call(vars, s)) return vars[s];
    throw BlockError('Variable "' + s + '" hasn\'t been created yet. Use a SET block first.');
  }
  // Locate operator at outermost level (right-to-left, lowest precedence first)
  const findOp = (chars) => {
    let depth = 0, inStr = null;
    for (let i = s.length - 1; i >= 0; i--) {
      const c = s.charAt(i);
      if (inStr) { if (c === inStr && s.charAt(i - 1) !== '\\') inStr = null; continue; }
      if (c === '"' || c === "'") { inStr = c; continue; }
      if (c === ')') depth++;
      else if (c === '(') depth--;
      else if (depth === 0 && chars.indexOf(c) !== -1) {
        if (i === 0) continue;
        return i;
      }
    }
    return -1;
  };
  let op = findOp('+-');
  if (op < 0) op = findOp('*/%');
  if (op > 0) {
    const left = evalBcExpr(s.slice(0, op), vars);
    const right = evalBcExpr(s.slice(op + 1), vars);
    const c = s.charAt(op);
    if (c === '+') {
      if (typeof left === 'string' || typeof right === 'string') return String(left) + String(right);
      return Number(left) + Number(right);
    }
    const nL = Number(left), nR = Number(right);
    if (isNaN(nL) || isNaN(nR)) throw BlockError('Can only do "' + c + '" with numbers.');
    if (c === '-') return nL - nR;
    if (c === '*') return nL * nR;
    if (c === '/') { if (nR === 0) throw BlockError('Cannot divide by zero.'); return nL / nR; }
    if (c === '%') { if (nR === 0) throw BlockError('Cannot use % with zero.'); return nL % nR; }
  }
  if (s.charAt(0) === '(' && s.charAt(s.length - 1) === ')') return evalBcExpr(s.slice(1, -1), vars);
  throw BlockError('Could not read the value: ' + s);
}

function evalBcCondition(c, vars) {
  if (!c || !c.op) throw BlockError('This IF/WHILE block needs a condition.');
  const l = evalBcExpr(c.left, vars);
  const r = evalBcExpr(c.right, vars);
  const nL = Number(l), nR = Number(r);
  const nums = !isNaN(nL) && !isNaN(nR);
  switch (c.op) {
    case '>':  return nums ? nL > nR  : String(l) > String(r);
    case '<':  return nums ? nL < nR  : String(l) < String(r);
    case '>=': return nums ? nL >= nR : String(l) >= String(r);
    case '<=': return nums ? nL <= nR : String(l) <= String(r);
    case '==': return String(l) === String(r);
    case '!=': return String(l) !== String(r);
    default:   return false;
  }
}

// --- Interpreter -----------------------------------------------------
async function runBcProgram(blocks, opts) {
  opts = opts || {};
  const ctx = {
    vars: {}, output: [], inputs: opts.inputs || [],
    robot: { x: 160, y: 100, dir: 0, penDown: false, trail: [] },
    steps: 0, maxSteps: 20000,
  };
  try {
    await execBcBlocks(blocks, ctx);
    return { ctx: ctx, error: null };
  } catch (e) {
    return { ctx: ctx, error: e.__block ? e.message : ('Unexpected: ' + String(e.message || e)) };
  }
}

async function execBcBlocks(blocks, ctx) {
  for (let i = 0; i < blocks.length; i++) {
    ctx.steps++;
    if (ctx.steps > ctx.maxSteps) throw BlockError('Your program took too long — infinite loop?');
    await execBcBlock(blocks[i], ctx);
  }
}

async function execBcBlock(b, ctx) {
  switch (b.type) {
    case 'print': {
      const v = evalBcExpr(b.text, ctx.vars);
      ctx.output.push(String(v));
      break;
    }
    case 'set': {
      if (!b.varName || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(b.varName))
        throw BlockError('Your SET block needs a valid variable name (letters/underscore, no spaces).');
      ctx.vars[b.varName] = evalBcExpr(b.value, ctx.vars);
      break;
    }
    case 'change': {
      if (!b.varName) throw BlockError('Your CHANGE block needs a variable name.');
      if (!Object.prototype.hasOwnProperty.call(ctx.vars, b.varName))
        throw BlockError('Variable "' + b.varName + '" hasn\'t been created. Use SET first.');
      const cur = Number(ctx.vars[b.varName]);
      if (isNaN(cur)) throw BlockError('Cannot CHANGE "' + b.varName + '" because it isn\'t a number.');
      ctx.vars[b.varName] = cur + Number(b.by || 0);
      break;
    }
    case 'ask': {
      const line = ctx.inputs.length ? ctx.inputs.shift() : '';
      const num = Number(line);
      ctx.vars[b.varName] = (line !== '' && !isNaN(num)) ? num : line;
      break;
    }
    case 'if': {
      if (evalBcCondition(b.condition, ctx.vars)) await execBcBlocks(b.body || [], ctx);
      break;
    }
    case 'ifelse': {
      if (evalBcCondition(b.condition, ctx.vars)) await execBcBlocks(b.body || [], ctx);
      else await execBcBlocks(b.elseBody || [], ctx);
      break;
    }
    case 'repeat': {
      const n = Number(evalBcExpr(b.times, ctx.vars));
      if (isNaN(n)) throw BlockError('REPEAT needs a number of times.');
      if (n < 0 || n > 10000) throw BlockError('REPEAT count must be between 0 and 10000.');
      for (let i = 0; i < n; i++) {
        ctx.steps++;
        if (ctx.steps > ctx.maxSteps) throw BlockError('Your program took too long.');
        await execBcBlocks(b.body || [], ctx);
      }
      break;
    }
    case 'while': {
      let guard = 0;
      while (evalBcCondition(b.condition, ctx.vars)) {
        if (++guard > 5000) throw BlockError('WHILE loop never ends — check the condition.');
        await execBcBlocks(b.body || [], ctx);
      }
      break;
    }
    case 'move': {
      const s = Number(evalBcExpr(b.steps, ctx.vars)) || 0;
      const rx = ctx.robot.x, ry = ctx.robot.y;
      ctx.robot.x += Math.cos(ctx.robot.dir) * s;
      ctx.robot.y += Math.sin(ctx.robot.dir) * s;
      if (ctx.robot.penDown) ctx.robot.trail.push({ x1: rx, y1: ry, x2: ctx.robot.x, y2: ctx.robot.y });
      break;
    }
    case 'turn': {
      const d = Number(b.degrees) || 0;
      ctx.robot.dir += d * Math.PI / 180;
      break;
    }
    case 'pen': {
      ctx.robot.penDown = !!b.penDown;
      break;
    }
    default:
      throw BlockError('Unknown block type: ' + b.type);
  }
}

// --- Python code generator -------------------------------------------
function bcToPython(blocks, indent) {
  indent = indent || 0;
  const pad = '    '.repeat(indent);
  if (!blocks || !blocks.length) return pad + 'pass';
  return blocks.map(b => {
    switch (b.type) {
      case 'print':  return pad + 'print(' + bcPyExpr(b.text) + ')';
      case 'set':    return pad + b.varName + ' = ' + bcPyExpr(b.value);
      case 'change': return pad + b.varName + ' = ' + b.varName + ' + ' + (b.by || 0);
      case 'ask':    return pad + b.varName + ' = input(' + JSON.stringify(b.prompt || '') + ')';
      case 'if':     return pad + 'if ' + bcPyCondition(b.condition) + ':\n' + bcToPython(b.body || [], indent + 1);
      case 'ifelse': return pad + 'if ' + bcPyCondition(b.condition) + ':\n' + bcToPython(b.body || [], indent + 1) + '\n' + pad + 'else:\n' + bcToPython(b.elseBody || [], indent + 1);
      case 'repeat': return pad + 'for i in range(' + (b.times || 0) + '):\n' + bcToPython(b.body || [], indent + 1);
      case 'while':  return pad + 'while ' + bcPyCondition(b.condition) + ':\n' + bcToPython(b.body || [], indent + 1);
      case 'move':   return pad + 'robot.forward(' + b.steps + ')';
      case 'turn':   return pad + 'robot.turn(' + b.degrees + ')';
      case 'pen':    return pad + 'robot.pen(' + (b.penDown ? 'True' : 'False') + ')';
      default:       return pad + '# unknown';
    }
  }).join('\n');
}
function bcPyExpr(raw) { const s = String(raw || '').trim(); return s || '""'; }
function bcPyCondition(c) { if (!c || !c.op) return 'True'; return bcPyExpr(c.left) + ' ' + c.op + ' ' + bcPyExpr(c.right); }

// --- Challenges -------------------------------------------------------
const BC_CHALLENGES = [
  { id: 'bc-1', level: 1, title: 'Say Hello', concept: 'sequence',
    task: 'Make the program print exactly:\n\nHello, World!',
    expected: ['Hello, World!'],
    hints: ['Use a PRINT block from the Output category.', 'The text needs quotes: "Hello, World!"', 'Add PRINT, edit the text to  "Hello, World!"'],
    starter: [] },
  { id: 'bc-2', level: 1, title: 'Two Lines', concept: 'sequence',
    task: 'Print these two lines (top to bottom):\n\nHello\nWorld',
    expected: ['Hello', 'World'],
    hints: ['You will need two PRINT blocks.', 'Order matters — blocks run top to bottom.', 'PRINT "Hello", then PRINT "World"'],
    starter: [] },
  { id: 'bc-3', level: 2, title: 'Personal Greeting', concept: 'variables',
    task: 'Create a variable  name  set to  "Alex"  and print:\n\nHello, Alex!',
    expected: ['Hello, Alex!'],
    hints: ['Start with SET name to "Alex".', 'Use PRINT with text and variable joined by +', 'PRINT "Hello, " + name + "!"'],
    starter: [] },
  { id: 'bc-4', level: 2, title: 'Add Two Numbers', concept: 'variables',
    task: 'Set  a  to 10 and  b  to 5. Print their sum.',
    expected: ['15'],
    hints: ['Two SET blocks, one PRINT.', 'In PRINT use:  a + b', 'SET a=10; SET b=5; PRINT a + b'],
    starter: [] },
  { id: 'bc-5', level: 3, title: 'Pass or Fail', concept: 'selection',
    task: 'Set  score  to 55. If score >= 50 print "Pass", otherwise print "Fail".',
    expected: ['Pass'],
    hints: ['SET score, then use IF / ELSE.', 'Condition: score >= 50', 'PRINT "Pass" in DO, PRINT "Fail" in ELSE.'],
    starter: [] },
  { id: 'bc-6', level: 3, title: 'Even or Odd', concept: 'selection',
    task: 'Set  x  to 4. If  x % 2  is 0 print "Even", otherwise print "Odd".',
    expected: ['Even'],
    hints: ['% is the remainder operator.', 'Condition:  x % 2 == 0', 'Use IF / ELSE with that condition.'],
    starter: [] },
  { id: 'bc-7', level: 4, title: 'Count to 5', concept: 'loops',
    task: 'Print the numbers 1 to 5 (one per line) using a variable and a REPEAT loop.',
    expected: ['1','2','3','4','5'],
    hints: ['SET n = 1 first.', 'REPEAT 5 times: PRINT n, then CHANGE n by 1.', 'The order inside the loop matters — print before changing.'],
    starter: [] },
  { id: 'bc-8', level: 4, title: 'Score to 100', concept: 'loops',
    task: 'Start with  score = 0 . Repeat 10 times: increase  score  by 10. Then print  score .',
    expected: ['100'],
    hints: ['SET score = 0 first.', 'REPEAT 10 with CHANGE score by 10 inside.', 'PRINT score AFTER the loop, not inside.'],
    starter: [] },
  { id: 'bc-9', level: 5, title: 'Sum 1 to 10', concept: 'combined',
    task: 'Use a loop to add 1 + 2 + ... + 10. Print the total (55).',
    expected: ['55'],
    hints: ['Two variables: total and n.', 'total = 0, n = 1. Loop 10 times: change total by n, change n by 1.', 'PRINT total AFTER the loop.'],
    starter: [] },
  { id: 'bc-10', level: 5, title: 'Even Numbers Only', concept: 'combined',
    task: 'For each number 1 to 10, print it only if it is even (divisible by 2).',
    expected: ['2','4','6','8','10'],
    hints: ['SET n = 1 first.', 'REPEAT 10 times: IF n % 2 == 0 PRINT n. Then CHANGE n by 1.', 'The IF goes INSIDE the REPEAT.'],
    starter: [] },
  { id: 'bc-11', level: 5, title: 'Draw a Square', concept: 'robot',
    task: 'Use ROBOT blocks with the pen down to draw a square. Move 60 steps then turn 90° — four times.',
    expected: [],
    checkRobot: function (r) { return r && r.trail && r.trail.length >= 4; },
    hints: ['First: PEN down.', 'REPEAT 4 times: MOVE 60, TURN 90.', 'You should see a square drawn on the stage.'],
    starter: [] },
  { id: 'bc-d1', level: 3, title: 'Debug: Fix the Counter', concept: 'debug',
    task: 'This program should count 1 to 3 — but it prints 1 three times. Find and fix the bug!',
    expected: ['1','2','3'],
    hints: ['What changes each time the loop runs?', 'The variable n never changes inside the loop.', 'Add a CHANGE n by 1 block inside, AFTER the PRINT.'],
    starter: null /* filled at runtime */ },
  { id: 'bc-d2', level: 3, title: 'Debug: Order Matters', concept: 'debug',
    task: 'This should print 5 then 10, but it prints 0 then 5. Rearrange the blocks!',
    expected: ['5','10'],
    hints: ['Look at when x is PRINTED vs when it is CHANGED.', 'The first PRINT happens BEFORE the first CHANGE.', 'Move the PRINT blocks to AFTER their CHANGE blocks.'],
    starter: null },
  { id: 'bc-p1', level: 2, title: 'Predict: Add 5', concept: 'predict',
    task: 'Look at the program below. Predict what it prints BEFORE running.\n\nSET x = 3\nCHANGE x by 5\nPRINT x',
    expected: ['8'],
    predict: true,
    hints: ['3 + 5 = ?', 'x starts at 3, gains 5, so becomes 8.', 'The final printed value is 8.'],
    starter: null },
];

// Fill in starters for debug/predict challenges at load time
function bcHydrateStarters() {
  for (const c of BC_CHALLENGES) {
    if (c.starter !== null) continue;
    if (c.id === 'bc-d1') c.starter = [
      { id: bcNewId(), type: 'set', varName: 'n', value: '1' },
      { id: bcNewId(), type: 'repeat', times: '3', body: [
        { id: bcNewId(), type: 'print', text: 'n' }
      ] }
    ];
    else if (c.id === 'bc-d2') c.starter = [
      { id: bcNewId(), type: 'set', varName: 'x', value: '0' },
      { id: bcNewId(), type: 'print', text: 'x' },
      { id: bcNewId(), type: 'change', varName: 'x', by: 5 },
      { id: bcNewId(), type: 'print', text: 'x' },
      { id: bcNewId(), type: 'change', varName: 'x', by: 5 }
    ];
    else if (c.id === 'bc-p1') c.starter = [
      { id: bcNewId(), type: 'set', varName: 'x', value: '3' },
      { id: bcNewId(), type: 'change', varName: 'x', by: 5 },
      { id: bcNewId(), type: 'print', text: 'x' }
    ];
    else c.starter = [];
  }
}
bcHydrateStarters();

// --- Progress ---------------------------------------------------------
function defaultBcProgress() { return { challenges: {}, conceptStats: {}, blocksUsed: 0 }; }
function loadBcProgress() { try { const raw = localStorage.getItem('cq:bcProgress'); if (!raw) return defaultBcProgress(); return { ...defaultBcProgress(), ...JSON.parse(raw) }; } catch { return defaultBcProgress(); } }
function saveBcProgress(p) { try { localStorage.setItem('cq:bcProgress', JSON.stringify(p)); } catch {} }
function recordBcAttempt(id, concept, opts) {
  opts = opts || {};
  const p = loadBcProgress();
  const prev = p.challenges[id] || { attempts: 0, solved: false, hintsUsed: 0, revealed: false };
  const wasFirst = !prev.solved && opts.solved;
  prev.attempts += 1;
  if (opts.solved) prev.solved = true;
  if (opts.hintUsed != null) prev.hintsUsed = Math.max(prev.hintsUsed || 0, opts.hintUsed);
  if (opts.revealed) prev.revealed = true;
  if (opts.confBefore != null) prev.confBefore = opts.confBefore;
  if (opts.confAfter != null) prev.confAfter = opts.confAfter;
  if (opts.helpLevel) prev.helpLevel = opts.helpLevel;
  p.challenges[id] = prev;
  if (concept) {
    const c = p.conceptStats[concept] || { attempts: 0, solved: 0, independent: 0 };
    c.attempts += 1;
    if (wasFirst) { c.solved += 1; if (!prev.revealed && (prev.hintsUsed || 0) === 0) c.independent += 1; }
    p.conceptStats[concept] = c;
  }
  saveBcProgress(p);
  return p;
}
function computeBcMastery(stats) {
  const s = stats || {};
  if ((s.independent || 0) >= 3) return { level: 4, label: 'Mastered',   icon: '🏆' };
  if ((s.solved || 0) >= 3)      return { level: 3, label: 'Confident',  icon: '🌳' };
  if ((s.solved || 0) >= 1)      return { level: 2, label: 'Developing', icon: '🌿' };
  return { level: 1, label: 'Starting', icon: '🌱' };
}

// --- UI helpers ------------------------------------------------------
function BcInlineInput({ value, onChange, placeholder, width, mono }) {
  return (
    <input type="text" value={value == null ? '' : value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || ''}
      className={'bc-inline ' + (mono === false ? '' : 'mono')}
      style={{ width: width || 80 }}
      spellCheck={false} autoCorrect="off" autoCapitalize="off" />
  );
}

function BcConditionEditor({ cond, onChange }) {
  const c = cond || { left: '', op: '>', right: '' };
  return (
    <span className="bc-cond">
      <BcInlineInput value={c.left} onChange={v => onChange({ ...c, left: v })} placeholder="score" width={72} />
      <select className="bc-op" value={c.op} onChange={e => onChange({ ...c, op: e.target.value })}>
        {['>','<','>=','<=','==','!='].map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <BcInlineInput value={c.right} onChange={v => onChange({ ...c, right: v })} placeholder="10" width={64} />
    </span>
  );
}

function bcMoveArr(arr, i, dir) {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const copy = [...arr];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

function BcBlockCard({ block, onChange, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown, isTarget, onSelectBody, onSelectElse }) {
  const cat = BC_BLOCKS[block.type]?.cat || 'output';
  const color = BC_CATEGORIES.find(c => c.id === cat)?.color || '#3b82f6';
  const upd = (patch) => onChange({ ...block, ...patch });
  let content = null;
  switch (block.type) {
    case 'print':
      content = <>print <BcInlineInput value={block.text} onChange={v => upd({ text: v })} placeholder='"Hello"' width={170} /></>;
      break;
    case 'set':
      content = <>set <BcInlineInput value={block.varName} onChange={v => upd({ varName: v })} placeholder="score" width={80} /> to <BcInlineInput value={block.value} onChange={v => upd({ value: v })} placeholder="0" width={110} /></>;
      break;
    case 'change':
      content = <>change <BcInlineInput value={block.varName} onChange={v => upd({ varName: v })} placeholder="score" width={80} /> by <BcInlineInput value={block.by} onChange={v => upd({ by: Number(v) || 0 })} placeholder="1" width={54} /></>;
      break;
    case 'ask':
      content = <>ask <BcInlineInput value={block.prompt} onChange={v => upd({ prompt: v })} placeholder="Your name?" width={140} mono={false} /> store in <BcInlineInput value={block.varName} onChange={v => upd({ varName: v })} placeholder="name" width={80} /></>;
      break;
    case 'if':
      content = <>if <BcConditionEditor cond={block.condition} onChange={c => upd({ condition: c })} /></>;
      break;
    case 'ifelse':
      content = <>if <BcConditionEditor cond={block.condition} onChange={c => upd({ condition: c })} /></>;
      break;
    case 'repeat':
      content = <>repeat <BcInlineInput value={block.times} onChange={v => upd({ times: v })} placeholder="5" width={54} /> times</>;
      break;
    case 'while':
      content = <>while <BcConditionEditor cond={block.condition} onChange={c => upd({ condition: c })} /></>;
      break;
    case 'move':
      content = <>move <BcInlineInput value={block.steps} onChange={v => upd({ steps: v })} placeholder="10" width={56} /> steps</>;
      break;
    case 'turn':
      content = <>turn <BcInlineInput value={block.degrees} onChange={v => upd({ degrees: Number(v) || 0 })} placeholder="90" width={56} /> °</>;
      break;
    case 'pen':
      content = <>pen <select className="bc-op" value={block.penDown ? '1' : '0'} onChange={e => upd({ penDown: e.target.value === '1' })}><option value="1">down</option><option value="0">up</option></select></>;
      break;
    default: content = <>{block.type}</>;
  }
  const kind = BC_BLOCKS[block.type]?.kind;
  const isContainer = kind === 'container' || kind === 'container2';
  return (
    <div className="bc-block-wrap">
      <div className={`bc-block ${isTarget ? 'bc-target' : ''}`} style={{ borderColor: color, background: color + '22' }}>
        <span className="bc-notch" style={{ background: color }} />
        <span className="bc-body">{content}</span>
        <span className="bc-btns">
          <button title="Move up" disabled={!canMoveUp} onClick={onMoveUp}>▲</button>
          <button title="Move down" disabled={!canMoveDown} onClick={onMoveDown}>▼</button>
          <button title="Delete" onClick={onDelete}>🗑</button>
        </span>
      </div>
      {isContainer && (
        <div className="bc-nest" style={{ borderLeftColor: color }}>
          {(block.body || []).length === 0 ? (
            <button className="bc-empty" onClick={onSelectBody}>+ add block inside</button>
          ) : (
            (block.body || []).map((b, i) => (
              <BcBlockCard key={b.id} block={b}
                onChange={nb => onChange({ ...block, body: block.body.map(x => x.id === b.id ? nb : x) })}
                onDelete={() => onChange({ ...block, body: block.body.filter(x => x.id !== b.id) })}
                onMoveUp={() => onChange({ ...block, body: bcMoveArr(block.body, i, -1) })}
                onMoveDown={() => onChange({ ...block, body: bcMoveArr(block.body, i, 1) })}
                canMoveUp={i > 0} canMoveDown={i < block.body.length - 1}
                isTarget={false}
                onSelectBody={onSelectBody} onSelectElse={onSelectElse} />
            ))
          )}
          {(block.body || []).length > 0 && (
            <button className="bc-add-here" onClick={onSelectBody}>+ add here</button>
          )}
        </div>
      )}
      {kind === 'container2' && (
        <>
          <div className="bc-else" style={{ borderColor: color, background: color + '22' }}>else</div>
          <div className="bc-nest" style={{ borderLeftColor: color }}>
            {(block.elseBody || []).length === 0 ? (
              <button className="bc-empty" onClick={onSelectElse}>+ add block inside else</button>
            ) : (
              (block.elseBody || []).map((b, i) => (
                <BcBlockCard key={b.id} block={b}
                  onChange={nb => onChange({ ...block, elseBody: block.elseBody.map(x => x.id === b.id ? nb : x) })}
                  onDelete={() => onChange({ ...block, elseBody: block.elseBody.filter(x => x.id !== b.id) })}
                  onMoveUp={() => onChange({ ...block, elseBody: bcMoveArr(block.elseBody, i, -1) })}
                  onMoveDown={() => onChange({ ...block, elseBody: bcMoveArr(block.elseBody, i, 1) })}
                  canMoveUp={i > 0} canMoveDown={i < block.elseBody.length - 1}
                  isTarget={false}
                  onSelectBody={onSelectBody} onSelectElse={onSelectElse} />
              ))
            )}
            {(block.elseBody || []).length > 0 && (
              <button className="bc-add-here" onClick={onSelectElse}>+ add here</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Robot stage
function BcRobotStage({ robot }) {
  const cvsRef = useRef();
  useEffect(() => {
    const cv = cvsRef.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = '#e5e5f0'; ctx.lineWidth = 1;
    for (let x = 0; x < cv.width; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cv.height); ctx.stroke(); }
    for (let y = 0; y < cv.height; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cv.width, y); ctx.stroke(); }
    if (robot && robot.trail) {
      ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (const s of robot.trail) { ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke(); }
    }
    const r = robot || { x: 160, y: 100, dir: 0 };
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.dir);
    ctx.fillStyle = '#22c55e';
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -9); ctx.lineTo(-10, 9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#065f46'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }, [robot]);
  return <canvas ref={cvsRef} width={320} height={200} className="bc-canvas" />;
}

function hasAsk(b) { if (!b) return false; if (b.type === 'ask') return true; return (b.body && b.body.some(hasAsk)) || (b.elseBody && b.elseBody.some(hasAsk)); }
function hasRobot(b) { if (!b) return false; if (b.type === 'move' || b.type === 'turn' || b.type === 'pen') return true; return (b.body && b.body.some(hasRobot)) || (b.elseBody && b.elseBody.some(hasRobot)); }

function BcChallengeView({ challenge, isFree, onBack, onSolved }) {
  const persistKey = isFree ? 'cq:bcFree' : ('cq:bcChal:' + (challenge && challenge.id));
  const [blocks, setBlocks] = useState(() => {
    try { const saved = localStorage.getItem(persistKey); if (saved) return JSON.parse(saved); } catch {}
    return challenge && challenge.starter && challenge.starter.length ? JSON.parse(JSON.stringify(challenge.starter)) : [];
  });
  useEffect(() => { try { localStorage.setItem(persistKey, JSON.stringify(blocks)); } catch {} }, [blocks, persistKey]);
  const [category, setCategory] = useState('output');
  const [output, setOutput] = useState([]);
  const [error, setError] = useState(null);
  const [showPython, setShowPython] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [robot, setRobot] = useState(null);
  const [addTarget, setAddTarget] = useState({ kind: 'root' });
  const [running, setRunning] = useState(false);
  const [solved, setSolved] = useState(false);
  const [predictInput, setPredictInput] = useState('');
  const [confBefore, setConfBefore] = useState(null);
  const [confAfter, setConfAfter] = useState(null);
  const [helpLevel, setHelpLevel] = useState(null);
  const [testInput, setTestInput] = useState('');

  useEffect(() => {
    setSolved(false); setOutput([]); setError(null);
    setHintLevel(0); setShowSolution(false); setRobot(null);
    setConfBefore(null); setConfAfter(null); setHelpLevel(null);
  }, [challenge && challenge.id]);

  const addBlock = (type) => {
    const nb = bcNewBlock(type);
    setBlocks(prev => {
      const cloned = JSON.parse(JSON.stringify(prev));
      const insertInto = (list, targetId, field) => {
        if (!targetId) { list.push(nb); return true; }
        for (const b of list) {
          if (b.id === targetId) { b[field] = b[field] || []; b[field].push(nb); return true; }
          if (b.body && insertInto(b.body, targetId, field)) return true;
          if (b.elseBody && insertInto(b.elseBody, targetId, field)) return true;
        }
        return false;
      };
      if (addTarget.kind === 'root') cloned.push(nb);
      else if (addTarget.kind === 'body') insertInto(cloned, addTarget.blockId, 'body');
      else if (addTarget.kind === 'else') insertInto(cloned, addTarget.blockId, 'elseBody');
      else cloned.push(nb);
      return cloned;
    });
  };

  const run = async () => {
    if (running) return;
    setRunning(true); setError(null); setOutput([]); setRobot(null);
    const inputs = testInput ? testInput.split('\n').filter(l => l.length > 0) : [];
    const res = await runBcProgram(blocks, { inputs });
    setRunning(false);
    if (res.error) { setError(res.error); return; }
    setOutput(res.ctx.output);
    setRobot(res.ctx.robot);
    if (challenge && !isFree) {
      const outOK = challenge.expected ? (challenge.expected.length === res.ctx.output.length && challenge.expected.every((line, i) => String(res.ctx.output[i] || '') === String(line))) : true;
      const robotOK = challenge.checkRobot ? challenge.checkRobot(res.ctx.robot) : true;
      const ok = outOK && robotOK;
      if (typeof Track !== 'undefined' && Track.pyRun) Track.pyRun(ok);
      recordBcAttempt(challenge.id, challenge.concept, { solved: ok, hintUsed: hintLevel, revealed: showSolution });
      if (ok && !solved) {
        setSolved(true);
        if (typeof fireConfetti === 'function') fireConfetti({ count: 30 });
        // Reward XP through the existing progress system
        try {
          const raw = localStorage.getItem('cq:progress');
          const cur = raw ? JSON.parse(raw) : { xp: 0, level: 1 };
          cur.xp = (cur.xp || 0) + 20;
          cur.level = 1 + Math.floor(Math.sqrt((cur.xp || 0) / 50));
          localStorage.setItem('cq:progress', JSON.stringify(cur));
        } catch {}
        if (onSolved) onSolved();
      }
    }
  };

  const checkPredict = () => {
    if (!challenge || !challenge.predict) return;
    const expected = (challenge.expected || []).join('\n');
    const ok = String(predictInput).trim() === expected.trim();
    setOutput(ok ? ['✅ Correct prediction!'] : ['❌ Not quite. Try running the program to see what it actually does.']);
    recordBcAttempt(challenge.id, challenge.concept, { solved: ok, hintUsed: hintLevel, revealed: showSolution });
    if (ok && !solved) { setSolved(true); if (typeof fireConfetti === 'function') fireConfetti({ count: 25 }); if (onSolved) onSolved(); }
  };

  const reset = () => {
    if (challenge && challenge.starter) setBlocks(JSON.parse(JSON.stringify(challenge.starter)));
    else setBlocks([]);
    setOutput([]); setError(null); setRobot(null);
  };

  const python = useMemo(() => bcToPython(blocks, 0), [blocks]);
  const paletteBlocks = Object.entries(BC_BLOCKS).filter(([t, meta]) => meta.cat === category).map(([t]) => t);
  const inCat = (id) => BC_CATEGORIES.find(c => c.id === id);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <button onClick={onBack} className="text-sm text-muted hover:text-ink">← Back</button>
      <div className="flex items-center gap-2 flex-wrap mt-1">
        <h1 className="font-display text-2xl">{isFree ? '🛠️ Free Build' : (challenge && challenge.title) || ''}</h1>
        {challenge && <span className="chip">Level {challenge.level}</span>}
        {challenge && challenge.concept === 'debug' && <span className="chip">🐛 Debug</span>}
        {challenge && challenge.predict && <span className="chip">🔮 Predict first</span>}
      </div>

      {challenge && (
        <div className="card p-4 mt-3">
          <div className="text-sm text-muted mb-1">Your task</div>
          <div className="whitespace-pre-wrap">{challenge.task}</div>
        </div>
      )}

      {challenge && confBefore === null && !solved && (
        <div className="card p-3 mt-3">
          <div className="font-display text-sm">🧠 Before you start — how confident are you?</div>
          <div className="flex gap-2 mt-2 flex-wrap">
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setConfBefore(n)} className="py-conf-btn">{n} {['😕','🤔','🙂','😎','🧠'][n-1]}</button>
            ))}
          </div>
        </div>
      )}

      <div className="bc-layout mt-4">
        <div className="bc-toolbox">
          <div className="bc-cats">
            {BC_CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setCategory(c.id)}
                className={`bc-cat ${category === c.id ? 'active' : ''}`}
                style={{ borderColor: c.color, background: category === c.id ? c.color + '22' : 'transparent' }}
                title={c.name}>
                <span>{c.icon}</span><span className="bc-catname">{c.name}</span>
              </button>
            ))}
          </div>
          <div className="bc-palette">
            <div className="text-xs text-muted mb-2">Click a block to add it:</div>
            {paletteBlocks.map(t => {
              const color = inCat(BC_BLOCKS[t].cat).color;
              return (
                <button key={t} onClick={() => addBlock(t)}
                  className="bc-palette-block"
                  style={{ borderColor: color, background: color + '22' }}>
                  <span className="bc-notch" style={{ background: color }} />{BC_BLOCKS[t].label}
                </button>
              );
            })}
          </div>
          <div className="bc-target-hint">
            <div className="text-xs text-muted mb-1">New blocks go into:</div>
            <div className="chip">{addTarget.kind === 'root' ? 'Main program' : addTarget.kind === 'body' ? 'Inside container' : 'Inside else'}</div>
            {addTarget.kind !== 'root' && <button onClick={() => setAddTarget({ kind: 'root' })} className="text-xs text-primary mt-2 block">↑ Back to main</button>}
          </div>
        </div>

        <div className="bc-workspace">
          <div className="bc-ws-header">
            <span className="text-xs text-muted">Program</span>
            <div className="bc-ws-actions">
              <button onClick={run} className="btn-primary !py-1.5 !px-3 text-sm" disabled={running}>{running ? '⏳ Running…' : '▶ Run Program'}</button>
              <button onClick={reset} className="btn-ghost !py-1.5 !px-3 text-sm">↻ Reset</button>
              <button onClick={() => setShowPython(s => !s)} className="btn-ghost !py-1.5 !px-3 text-sm">{showPython ? 'Hide Python' : '🐍 Show Python'}</button>
            </div>
          </div>
          <div className="bc-ws-body">
            {blocks.length === 0 ? (
              <div className="bc-ws-empty">Click a block from the toolbox to start →</div>
            ) : (
              blocks.map((b, i) => (
                <BcBlockCard key={b.id} block={b}
                  onChange={nb => setBlocks(blocks.map(x => x.id === b.id ? nb : x))}
                  onDelete={() => setBlocks(blocks.filter(x => x.id !== b.id))}
                  onMoveUp={() => setBlocks(bcMoveArr(blocks, i, -1))}
                  onMoveDown={() => setBlocks(bcMoveArr(blocks, i, 1))}
                  canMoveUp={i > 0} canMoveDown={i < blocks.length - 1}
                  isTarget={addTarget.kind !== 'root' && addTarget.blockId === b.id}
                  onSelectBody={() => setAddTarget({ kind: 'body', blockId: b.id })}
                  onSelectElse={() => setAddTarget({ kind: 'else', blockId: b.id })} />
              ))
            )}
          </div>
        </div>
      </div>

      {blocks.some(hasAsk) && (
        <div className="mt-3">
          <div className="text-sm text-muted mb-1">Test input (one line per ASK):</div>
          <textarea className="input font-mono w-full text-sm" rows={2} value={testInput} onChange={e => setTestInput(e.target.value)} placeholder="e.g. Alex" />
        </div>
      )}

      {challenge && challenge.predict && !solved && (
        <div className="card p-3 mt-3">
          <div className="font-display text-sm">🔮 Predict the output first</div>
          <textarea className="input font-mono w-full mt-2" rows={3} value={predictInput} onChange={e => setPredictInput(e.target.value)} placeholder="Type each line of output" />
          <button onClick={checkPredict} className="btn-primary mt-2">Check my prediction</button>
        </div>
      )}

      <div className="mt-4">
        <div className="text-sm text-muted mb-1">💻 Program output</div>
        <div className={`py-output ${error ? 'error' : ''}`}>
          <div className="py-output-header">{error ? '⚠️ Something went wrong' : '▸ Output'}</div>
          {error ? error : (output.length === 0 ? '(nothing yet — click Run Program)' : output.join('\n'))}
        </div>
      </div>

      {blocks.some(hasRobot) && (
        <div className="mt-4">
          <div className="text-sm text-muted mb-1">🤖 Robot stage</div>
          <BcRobotStage robot={robot} />
        </div>
      )}

      {showPython && (
        <div className="card p-4 mt-4 py-solution-card">
          <div className="flex items-center justify-between">
            <div className="font-display">🐍 Same program in Python</div>
            <button onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(python); }} className="btn-ghost !py-1 !px-2 text-xs">Copy</button>
          </div>
          <pre className="code-block mt-2">{python || '# empty program'}</pre>
          <div className="text-xs text-muted mt-2">These blocks and this Python program do the same thing. When you're ready, try writing this yourself in Python Practice.</div>
        </div>
      )}

      {challenge && !isFree && (
        <div className="card p-4 mt-4">
          <div className="font-display text-lg">💡 Stuck? Take one clue at a time.</div>
          {hintLevel >= 1 && challenge.hints[0] && (<div className="py-hint-card mt-2">💡 <b>Hint 1:</b> {challenge.hints[0]}</div>)}
          {hintLevel >= 2 && challenge.hints[1] && (<div className="py-hint-card mt-2">💡 <b>Hint 2:</b> {challenge.hints[1]}</div>)}
          {showSolution && challenge.hints[2] && (
            <div className="py-solution-card mt-2">
              <div className="font-semibold text-sm mb-1">👀 One way to solve it:</div>
              <div>{challenge.hints[2]}</div>
            </div>
          )}
          <div className="flex gap-2 mt-3 flex-wrap">
            {hintLevel < 1 && challenge.hints[0] && <button onClick={() => { setHintLevel(1); recordBcAttempt(challenge.id, challenge.concept, { hintUsed: 1 }); }} className="btn-ghost">💡 Hint 1</button>}
            {hintLevel >= 1 && hintLevel < 2 && challenge.hints[1] && <button onClick={() => { setHintLevel(2); recordBcAttempt(challenge.id, challenge.concept, { hintUsed: 2 }); }} className="btn-ghost">💡 Hint 2</button>}
            {!showSolution && challenge.hints[2] && (
              <button onClick={() => { if (confirm('Reveal the solution? Try it yourself first!')) { setShowSolution(true); recordBcAttempt(challenge.id, challenge.concept, { revealed: true, hintUsed: hintLevel }); } }} className="btn-ghost">👀 Show me</button>
            )}
          </div>
        </div>
      )}

      {solved && challenge && (
        <div className="card p-4 mt-4 anim-pop" style={{ borderColor: 'var(--cq-success)' }}>
          <div className="font-display" style={{ color: 'var(--cq-success)' }}>🎉 Challenge complete!</div>
          <div className="text-sm mt-1">+20 XP added to your ComputeQuest total.</div>
          <div className="mt-4">
            <div className="text-sm font-semibold">How confident do you feel NOW?</div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => { setConfAfter(n); recordBcAttempt(challenge.id, challenge.concept, { confBefore: confBefore, confAfter: n }); }} className={`py-conf-btn ${confAfter === n ? 'active' : ''}`}>{n} {['😕','🤔','🙂','😎','🧠'][n-1]}</button>
              ))}
            </div>
          </div>
          {confAfter !== null && (
            <div className="mt-3">
              <div className="text-sm font-semibold">How much help did you need?</div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {[['none','🟢 None'],['little','🟡 A little'],['several','🟠 Several hints'],['solution','🔴 I needed the solution']].map(([k, label]) => (
                  <button key={k} onClick={() => { setHelpLevel(k); recordBcAttempt(challenge.id, challenge.concept, { helpLevel: k }); }} className={`py-conf-btn ${helpLevel === k ? 'active' : ''}`}>{label}</button>
                ))}
              </div>
            </div>
          )}
          {confBefore != null && confAfter != null && (
            <div className="mt-3 p-3 bg-sunken rounded-lg">
              <div className="font-display">📈 Your learning</div>
              <div className="text-sm mt-1">Confidence: <b>{confBefore}</b> → <b>{confAfter}</b></div>
              {(confAfter - confBefore) > 0 && <div className="text-sm mt-1" style={{ color: 'var(--cq-success)' }}>Your confidence grew by {confAfter - confBefore}. Nice work! 🌟</div>}
              {(confAfter - confBefore) === 0 && <div className="text-sm mt-1 text-muted">Confidence held steady — try one more like this to build it up.</div>}
              {(confAfter - confBefore) < 0 && <div className="text-sm mt-1 text-muted">Confidence dipped — that's honest, and useful. Try a similar challenge to consolidate.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BcProgressView({ onBack }) {
  const p = loadBcProgress();
  const done = Object.values(p.challenges).filter(c => c.solved).length;
  const indep = Object.values(p.challenges).filter(c => c.solved && !c.revealed && (c.hintsUsed || 0) === 0).length;
  const hints = Object.values(p.challenges).reduce((s, c) => s + (c.hintsUsed || 0), 0);
  const confs = Object.values(p.challenges).map(c => c.confAfter).filter(x => x != null);
  const before = Object.values(p.challenges).map(c => c.confBefore).filter(x => x != null);
  const avgAfter = confs.length ? (confs.reduce((s, v) => s + v, 0) / confs.length).toFixed(1) : '—';
  const avgBefore = before.length ? (before.reduce((s, v) => s + v, 0) / before.length).toFixed(1) : '—';
  const concepts = ['sequence','variables','selection','loops','combined','debug','robot','predict'];
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <button onClick={onBack} className="text-sm text-muted hover:text-ink">← Block Coding home</button>
      <h1 className="font-display text-2xl mt-1">🧩 My Block Coding Progress</h1>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
        <div className="card p-3"><div className="text-2xl">🧩</div><div className="font-display text-xl">{done}</div><div className="text-xs text-muted">Challenges done</div></div>
        <div className="card p-3"><div className="text-2xl">💪</div><div className="font-display text-xl">{indep}</div><div className="text-xs text-muted">Independent</div></div>
        <div className="card p-3"><div className="text-2xl">💡</div><div className="font-display text-xl">{hints}</div><div className="text-xs text-muted">Hints used</div></div>
        <div className="card p-3"><div className="text-2xl">📈</div><div className="font-display text-xl">{avgBefore} → {avgAfter}</div><div className="text-xs text-muted">Confidence</div></div>
        <div className="card p-3"><div className="text-2xl">🎯</div><div className="font-display text-xl">{Math.round(done / BC_CHALLENGES.length * 100)}%</div><div className="text-xs text-muted">Overall</div></div>
      </div>
      <h2 className="font-display text-xl mt-6 mb-3">Progress by concept</h2>
      <div className="grid gap-2">
        {concepts.map(cn => {
          const cs = BC_CHALLENGES.filter(c => c.concept === cn);
          if (cs.length === 0) return null;
          const doneCount = cs.filter(c => p.challenges[c.id] && p.challenges[c.id].solved).length;
          const pct = Math.round(doneCount / cs.length * 100);
          const m = computeBcMastery(p.conceptStats[cn]);
          return (
            <div key={cn} className="card p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[120px] font-medium text-sm capitalize">{cn}</div>
              <div className="py-progress-bar flex-1 min-w-[120px]"><div style={{ width: pct + '%' }} /></div>
              <span className={`py-mastery-badge py-mastery-${m.level}`}>{m.icon} {m.label}</span>
              <span className="text-xs text-muted w-12 text-right">{doneCount}/{cs.length}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BlockCodingStudio({ onNav }) {
  const [subview, setSubview] = useState('menu');
  const [current, setCurrent] = useState(null);
  const [ver, setVer] = useState(0);
  const bcp = loadBcProgress();
  const openChallenge = (c) => { setCurrent(c); setSubview('challenge'); };
  if (subview === 'challenge' && current) return <BcChallengeView challenge={current} onBack={() => setSubview('menu')} onSolved={() => setVer(v => v + 1)} />;
  if (subview === 'free') return <BcChallengeView isFree={true} onBack={() => setSubview('menu')} />;
  if (subview === 'progress') return <BcProgressView onBack={() => setSubview('menu')} />;

  const totalDone = Object.values(bcp.challenges).filter(c => c.solved).length;
  const overallPct = Math.round(totalDone / BC_CHALLENGES.length * 100);
  const levels = [
    { n: 1, name: 'Beginner',    icon: '🟢', desc: 'Sequence & print' },
    { n: 2, name: 'Variables',   icon: '🔵', desc: 'Create, change, use' },
    { n: 3, name: 'Logic',       icon: '🟡', desc: 'if / else, comparisons' },
    { n: 4, name: 'Loops',       icon: '🟠', desc: 'Repeat & count' },
    { n: 5, name: 'Combined',    icon: '🔴', desc: 'Multi-step challenges' },
  ];
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <button onClick={() => onNav({ page: 'home' })} className="text-sm text-muted hover:text-ink">← Home</button>
      <div className="flex items-center gap-4 mt-1 flex-wrap">
        <div className="text-5xl anim-float">🧩</div>
        <div>
          <h1 className="font-display text-3xl">Block Coding Studio</h1>
          <div className="text-muted">Learn programming by building it. Click blocks ▸ Snap them together ▸ Run ▸ Debug.</div>
        </div>
      </div>

      <div className="card p-4 mt-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="font-display">Your Block Journey</div>
            <div className="text-muted text-sm">Progress: {overallPct}% · {totalDone}/{BC_CHALLENGES.length} challenges done</div>
          </div>
          <button onClick={() => setSubview('progress')} className="btn-ghost">📈 Full progress</button>
        </div>
        <div className="py-progress-bar mt-3"><div style={{ width: overallPct + '%' }} /></div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <button onClick={() => setSubview('free')} className="card tilt p-4 text-left">
          <div className="text-3xl">🛠️</div>
          <div className="font-display text-lg mt-1">Free Build</div>
          <div className="text-muted text-sm">Experiment freely. See the Python equivalent live.</div>
        </button>
        <button onClick={() => { const first = BC_CHALLENGES.find(c => !bcp.challenges[c.id] || !bcp.challenges[c.id].solved) || BC_CHALLENGES[0]; openChallenge(first); }} className="card tilt p-4 text-left">
          <div className="text-3xl">🚀</div>
          <div className="font-display text-lg mt-1">Continue Learning</div>
          <div className="text-muted text-sm">Jump to your next unfinished challenge.</div>
        </button>
      </div>

      <h2 className="font-display text-xl mt-6 mb-3">🎯 Challenge Levels</h2>
      <div className="grid gap-3">
        {levels.map(lv => {
          const cs = BC_CHALLENGES.filter(c => c.level === lv.n && !c.predict && c.concept !== 'debug');
          const done = cs.filter(c => bcp.challenges[c.id] && bcp.challenges[c.id].solved).length;
          const pct = cs.length ? Math.round(done / cs.length * 100) : 0;
          const unlocked = lv.n === 1 || BC_CHALLENGES.filter(c => c.level < lv.n && bcp.challenges[c.id] && bcp.challenges[c.id].solved).length >= 1;
          return (
            <div key={lv.n} className="card p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-2xl">{lv.icon}</div>
                <div className="flex-1 min-w-[160px]">
                  <div className="font-display">Level {lv.n} — {lv.name} {!unlocked && '🔒'}</div>
                  <div className="text-muted text-sm">{lv.desc}</div>
                </div>
                <div className="text-xs text-muted">{done}/{cs.length}</div>
                <div className="py-progress-bar w-32"><div style={{ width: pct + '%' }} /></div>
              </div>
              <div className={`mt-3 grid sm:grid-cols-2 gap-2 ${!unlocked ? 'opacity-40 pointer-events-none' : ''}`}>
                {cs.map(c => {
                  const solved = bcp.challenges[c.id] && bcp.challenges[c.id].solved;
                  return (
                    <button key={c.id} onClick={() => openChallenge(c)} className="text-left p-2 rounded-lg hover:bg-sunken border border-line transition">
                      <div className="flex items-center gap-2">
                        <span>{solved ? '✅' : '🧩'}</span>
                        <span className="font-medium text-sm">{c.title}</span>
                      </div>
                      <div className="text-xs text-muted mt-1">{c.concept}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="font-display text-xl mt-6 mb-3">🧠 Special Practice</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {BC_CHALLENGES.filter(c => c.concept === 'debug').map(c => (
          <button key={c.id} onClick={() => openChallenge(c)} className="card p-3 text-left hover:border-primary">
            <div className="flex items-center gap-2">
              <span>{bcp.challenges[c.id] && bcp.challenges[c.id].solved ? '✅' : '🐛'}</span>
              <span className="font-display text-sm">{c.title}</span>
            </div>
            <div className="text-muted text-xs mt-1">Find and fix the bug</div>
          </button>
        ))}
        {BC_CHALLENGES.filter(c => c.predict).map(c => (
          <button key={c.id} onClick={() => openChallenge(c)} className="card p-3 text-left hover:border-primary">
            <div className="flex items-center gap-2">
              <span>{bcp.challenges[c.id] && bcp.challenges[c.id].solved ? '✅' : '🔮'}</span>
              <span className="font-display text-sm">{c.title}</span>
            </div>
            <div className="text-muted text-xs mt-1">Predict the output first</div>
          </button>
        ))}
      </div>

      <div className="card p-4 mt-6" style={{ borderColor: 'var(--cq-warn)' }}>
        <div className="font-display">🐍 Bridge to Python</div>
        <div className="text-muted text-sm mt-1">Every block program can be shown as Python — click <b>Show Python</b> in any challenge. Once you feel confident with blocks, try the <b>Python Practice</b> section for text-based code.</div>
        <button onClick={() => onNav({ page: 'python' })} className="btn-ghost mt-3">Open Python Practice →</button>
      </div>
    </div>
  );
}
