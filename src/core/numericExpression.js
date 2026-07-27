// Parser y evaluador cerrado para las fórmulas numéricas del modelo.
// La gramática deliberadamente no incluye llamadas, propiedades genéricas, arrays ni globals.

export const MAX_EXPRESSION_DEPTH = 64;
export const MAX_EXPRESSION_TOKENS = 512;

export class NumericExpressionError extends Error {
  constructor(code, message, position = null) {
    super(message);
    this.name = 'NumericExpressionError';
    this.code = code;
    this.position = position;
  }
}

function fail(code, message, position) {
  throw new NumericExpressionError(code, message, position);
}

function tokenize(source) {
  const tokens = [];
  let position = 0;

  while (position < source.length) {
    const rest = source.slice(position);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) {
      position += whitespace[0].length;
      continue;
    }

    const reference = rest.match(/^([a-zA-Z_][a-zA-Z0-9_]*|\d+)\.([a-zA-Z_][a-zA-Z0-9_]*)\b/);
    if (reference) {
      tokens.push({
        type: 'reference',
        elementId: reference[1],
        field: reference[2],
        position
      });
      position += reference[0].length;
    } else {
      const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (number) {
        const value = Number(number[0]);
        if (!Number.isFinite(value)) fail('INVALID_NUMBER', 'Número fuera de rango', position);
        tokens.push({ type: 'number', value, position });
        position += number[0].length;
      } else {
        const identifier = rest.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
        if (identifier) {
          tokens.push({ type: 'identifier', name: identifier[0], position });
          position += identifier[0].length;
        } else if ('+-*/()'.includes(source[position])) {
          tokens.push({ type: source[position], position });
          position += 1;
        } else {
          fail('UNSUPPORTED_SYNTAX', `Token no permitido: ${source[position]}`, position);
        }
      }
    }

    if (tokens.length > MAX_EXPRESSION_TOKENS) {
      fail('EXPRESSION_TOO_LONG', 'La fórmula excede el máximo de tokens', position);
    }
  }

  tokens.push({ type: 'eof', position });
  return tokens;
}

function nodeDepth(node) {
  return node.depth || 1;
}

function checkedNode(node, position) {
  if (nodeDepth(node) > MAX_EXPRESSION_DEPTH) {
    fail('EXPRESSION_TOO_DEEP', 'La fórmula excede la profundidad máxima', position);
  }
  return node;
}

export function parseNumericExpression(source) {
  if (typeof source !== 'string' || source.trim() === '') {
    fail('EMPTY_EXPRESSION', 'La fórmula está vacía', 0);
  }

  const tokens = tokenize(source);
  let cursor = 0;
  const current = () => tokens[cursor];
  const consume = (type) => {
    if (current().type !== type) {
      fail('UNEXPECTED_TOKEN', `Se esperaba ${type}`, current().position);
    }
    const token = current();
    cursor += 1;
    return token;
  };

  const parsePrimary = (parenthesisDepth = 0) => {
    const token = current();
    if (token.type === 'number') {
      cursor += 1;
      return { type: 'number', value: token.value, depth: 1 };
    }
    if (token.type === 'identifier') {
      cursor += 1;
      return { type: 'identifier', name: token.name, depth: 1 };
    }
    if (token.type === 'reference') {
      cursor += 1;
      return {
        type: 'reference',
        elementId: token.elementId,
        field: token.field,
        depth: 1
      };
    }
    if (token.type === '(') {
      if (parenthesisDepth + 1 > MAX_EXPRESSION_DEPTH) {
        fail('EXPRESSION_TOO_DEEP', 'La fórmula excede la profundidad máxima', token.position);
      }
      cursor += 1;
      const expression = parseAdditive(parenthesisDepth + 1);
      consume(')');
      return checkedNode({ ...expression, depth: nodeDepth(expression) + 1 }, token.position);
    }
    fail('UNEXPECTED_TOKEN', 'Se esperaba un número, referencia o paréntesis', token.position);
  };

  const parseUnary = (parenthesisDepth = 0) => {
    const token = current();
    if (token.type === '+' || token.type === '-') {
      cursor += 1;
      const argument = parseUnary(parenthesisDepth);
      return checkedNode({
        type: 'unary',
        operator: token.type,
        argument,
        depth: nodeDepth(argument) + 1
      }, token.position);
    }
    return parsePrimary(parenthesisDepth);
  };

  const parseMultiplicative = (parenthesisDepth = 0) => {
    let left = parseUnary(parenthesisDepth);
    while (current().type === '*' || current().type === '/') {
      const operator = current();
      cursor += 1;
      const right = parseUnary(parenthesisDepth);
      left = checkedNode({
        type: 'binary',
        operator: operator.type,
        left,
        right,
        depth: Math.max(nodeDepth(left), nodeDepth(right)) + 1
      }, operator.position);
    }
    return left;
  };

  function parseAdditive(parenthesisDepth = 0) {
    let left = parseMultiplicative(parenthesisDepth);
    while (current().type === '+' || current().type === '-') {
      const operator = current();
      cursor += 1;
      const right = parseMultiplicative(parenthesisDepth);
      left = checkedNode({
        type: 'binary',
        operator: operator.type,
        left,
        right,
        depth: Math.max(nodeDepth(left), nodeDepth(right)) + 1
      }, operator.position);
    }
    return left;
  }

  const ast = parseAdditive();
  consume('eof');
  return ast;
}

export function evaluateNumericAst(ast, resolvers = {}, depth = 0) {
  if (depth > MAX_EXPRESSION_DEPTH) {
    fail('EXPRESSION_TOO_DEEP', 'La fórmula excede la profundidad máxima');
  }

  let value;
  if (ast.type === 'number') {
    value = ast.value;
  } else if (ast.type === 'identifier') {
    value = resolvers.resolveIdentifier?.(ast.name);
  } else if (ast.type === 'reference') {
    value = resolvers.resolveReference?.(ast.elementId, ast.field);
  } else if (ast.type === 'unary') {
    const argument = evaluateNumericAst(ast.argument, resolvers, depth + 1);
    value = ast.operator === '-' ? -argument : +argument;
  } else if (ast.type === 'binary') {
    const left = evaluateNumericAst(ast.left, resolvers, depth + 1);
    const right = evaluateNumericAst(ast.right, resolvers, depth + 1);
    if (ast.operator === '+') value = left + right;
    if (ast.operator === '-') value = left - right;
    if (ast.operator === '*') value = left * right;
    if (ast.operator === '/') value = left / right;
  } else {
    fail('INVALID_AST', 'Nodo de fórmula desconocido');
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail('NON_FINITE_RESULT', 'La fórmula no produjo un número finito');
  }
  return value;
}

export function evaluateNumericExpression(source, resolvers = {}) {
  return evaluateNumericAst(parseNumericExpression(source), resolvers);
}

export function walkNumericAst(ast, visitor) {
  visitor(ast);
  if (ast.type === 'unary') walkNumericAst(ast.argument, visitor);
  if (ast.type === 'binary') {
    walkNumericAst(ast.left, visitor);
    walkNumericAst(ast.right, visitor);
  }
}
