(function () {
  const App = self.QNMApp;
  const FUNCTIONS = new Set([
    "abs",
    "acos",
    "acosh",
    "asin",
    "asinh",
    "atan",
    "atanh",
    "cos",
    "cosh",
    "exp",
    "ln",
    "log",
    "max",
    "min",
    "pow",
    "sin",
    "sinh",
    "sqrt",
    "tan",
    "tanh"
  ]);
  const CONSTANTS = new Set(["pi", "e"]);

  function isDigit(ch) {
    return ch >= "0" && ch <= "9";
  }

  function isIdentifierStart(ch) {
    if (!ch) {
      return false;
    }
    const code = ch.charCodeAt(0);
    return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || ch === "_" || code > 127;
  }

  function isIdentifierPart(ch) {
    return isIdentifierStart(ch) || isDigit(ch);
  }

  function tokenize(input) {
    const tokens = [];
    let index = 0;
    while (index < input.length) {
      const ch = input[index];
      if (/\s/u.test(ch)) {
        index += 1;
        continue;
      }
      if ("()+-*/^,".includes(ch)) {
        tokens.push({ type: ch, value: ch, index });
        index += 1;
        continue;
      }
      if (isDigit(ch) || (ch === "." && isDigit(input[index + 1]))) {
        let end = index;
        let seenDot = ch === ".";
        while (end < input.length) {
          const c = input[end];
          if (isDigit(c)) {
            end += 1;
            continue;
          }
          if (c === "." && !seenDot) {
            seenDot = true;
            end += 1;
            continue;
          }
          break;
        }
        if (input[end] === "e" || input[end] === "E") {
          let expEnd = end + 1;
          if (input[expEnd] === "+" || input[expEnd] === "-") {
            expEnd += 1;
          }
          let expDigits = expEnd;
          while (isDigit(input[expEnd])) {
            expEnd += 1;
          }
          if (expEnd === expDigits) {
            throw new Error("Некорректная экспоненциальная запись рядом с позицией " + end + ".");
          }
          end = expEnd;
        }
        tokens.push({ type: "number", value: input.slice(index, end), index });
        index = end;
        continue;
      }
      if (isIdentifierStart(ch)) {
        let end = index + 1;
        while (end < input.length && isIdentifierPart(input[end])) {
          end += 1;
        }
        tokens.push({ type: "identifier", value: input.slice(index, end), index });
        index = end;
        continue;
      }
      throw new Error("Недопустимый символ \"" + ch + "\" в позиции " + index + ".");
    }
    tokens.push({ type: "eof", value: "", index: input.length });
    return tokens;
  }

  function createParser(tokens) {
    let position = 0;

    function peek() {
      return tokens[position];
    }

    function consume(type) {
      const token = tokens[position];
      if (type && token.type !== type) {
        throw new Error("Ожидался токен " + type + " в позиции " + token.index + ".");
      }
      position += 1;
      return token;
    }

    function parsePrimary() {
      const token = peek();
      if (token.type === "number") {
        consume("number");
        return { kind: "number", value: token.value };
      }
      if (token.type === "identifier") {
        consume("identifier");
        if (peek().type === "(") {
          consume("(");
          const args = [];
          if (peek().type !== ")") {
            while (true) {
              args.push(parseExpression());
              if (peek().type === ",") {
                consume(",");
                continue;
              }
              break;
            }
          }
          consume(")");
          return { kind: "call", name: token.value, args };
        }
        return { kind: "identifier", name: token.value };
      }
      if (token.type === "(") {
        consume("(");
        const expr = parseExpression();
        consume(")");
        return expr;
      }
      if (token.type === "+") {
        consume("+");
        return { kind: "unary", op: "+", arg: parsePrimary() };
      }
      if (token.type === "-") {
        consume("-");
        return { kind: "unary", op: "-", arg: parsePrimary() };
      }
      throw new Error("Неожиданный токен в позиции " + token.index + ".");
    }

    function parsePower() {
      let left = parsePrimary();
      if (peek().type === "^") {
        consume("^");
        left = { kind: "binary", op: "^", left, right: parsePower() };
      }
      return left;
    }

    function parseTerm() {
      let left = parsePower();
      while (peek().type === "*" || peek().type === "/") {
        const op = consume().type;
        left = { kind: "binary", op, left, right: parsePower() };
      }
      return left;
    }

    function parseExpression() {
      let left = parseTerm();
      while (peek().type === "+" || peek().type === "-") {
        const op = consume().type;
        left = { kind: "binary", op, left, right: parseTerm() };
      }
      return left;
    }

    const ast = parseExpression();
    if (peek().type !== "eof") {
      throw new Error("Лишний фрагмент выражения в позиции " + peek().index + ".");
    }
    return ast;
  }

  function parseExpression(input) {
    return createParser(tokenize(input));
  }

  function walkAst(node, visitor) {
    visitor(node);
    if (node.kind === "binary") {
      walkAst(node.left, visitor);
      walkAst(node.right, visitor);
      return;
    }
    if (node.kind === "unary") {
      walkAst(node.arg, visitor);
      return;
    }
    if (node.kind === "call") {
      for (const arg of node.args) {
        walkAst(arg, visitor);
      }
    }
  }

  function collectParameters(astList) {
    const params = new Set();
    for (const ast of astList) {
      walkAst(ast, (node) => {
        if (node.kind === "identifier" && node.name !== "r" && !CONSTANTS.has(node.name)) {
          params.add(node.name);
        }
        if (node.kind === "call" && !FUNCTIONS.has(node.name)) {
          throw new Error("Неизвестная функция \"" + node.name + "\".");
        }
      });
    }
    return Array.from(params).sort((a, b) => a.localeCompare(b, "ru"));
  }

  function ensureArgCount(name, args, counts) {
    if (!counts.includes(args.length)) {
      throw new Error("Функция \"" + name + "\" получила " + args.length + " арг., ожидалось: " + counts.join(" или ") + ".");
    }
  }

  function evaluateAst(ast, env, D) {
    switch (ast.kind) {
      case "number":
        return new D(ast.value);
      case "identifier": {
        if (ast.name === "pi") {
          return D.acos(-1);
        }
        if (ast.name === "e") {
          return D.exp(1);
        }
        if (!(ast.name in env)) {
          throw new Error("Не задан параметр \"" + ast.name + "\".");
        }
        return env[ast.name];
      }
      case "unary": {
        const value = evaluateAst(ast.arg, env, D);
        return ast.op === "-" ? value.neg() : value;
      }
      case "binary": {
        const left = evaluateAst(ast.left, env, D);
        const right = evaluateAst(ast.right, env, D);
        if (ast.op === "+") {
          return left.plus(right);
        }
        if (ast.op === "-") {
          return left.minus(right);
        }
        if (ast.op === "*") {
          return left.times(right);
        }
        if (ast.op === "/") {
          return left.div(right);
        }
        if (ast.op === "^") {
          return left.pow(right);
        }
        throw new Error("Неизвестная операция \"" + ast.op + "\".");
      }
      case "call": {
        const args = ast.args.map((arg) => evaluateAst(arg, env, D));
        const name = ast.name;
        if (name === "abs") {
          ensureArgCount(name, args, [1]);
          return args[0].abs();
        }
        if (name === "sqrt") {
          ensureArgCount(name, args, [1]);
          return args[0].sqrt();
        }
        if (name === "exp") {
          ensureArgCount(name, args, [1]);
          return args[0].exp();
        }
        if (name === "ln") {
          ensureArgCount(name, args, [1]);
          return args[0].ln();
        }
        if (name === "log") {
          ensureArgCount(name, args, [1, 2]);
          return args.length === 1 ? args[0].ln() : args[0].log(args[1]);
        }
        if (name === "sin") {
          ensureArgCount(name, args, [1]);
          return args[0].sin();
        }
        if (name === "cos") {
          ensureArgCount(name, args, [1]);
          return args[0].cos();
        }
        if (name === "tan") {
          ensureArgCount(name, args, [1]);
          return args[0].tan();
        }
        if (name === "asin") {
          ensureArgCount(name, args, [1]);
          return args[0].asin();
        }
        if (name === "acos") {
          ensureArgCount(name, args, [1]);
          return args[0].acos();
        }
        if (name === "atan") {
          ensureArgCount(name, args, [1]);
          return args[0].atan();
        }
        if (name === "sinh") {
          ensureArgCount(name, args, [1]);
          return args[0].sinh();
        }
        if (name === "cosh") {
          ensureArgCount(name, args, [1]);
          return args[0].cosh();
        }
        if (name === "tanh") {
          ensureArgCount(name, args, [1]);
          return args[0].tanh();
        }
        if (name === "asinh") {
          ensureArgCount(name, args, [1]);
          return args[0].asinh();
        }
        if (name === "acosh") {
          ensureArgCount(name, args, [1]);
          return args[0].acosh();
        }
        if (name === "atanh") {
          ensureArgCount(name, args, [1]);
          return args[0].atanh();
        }
        if (name === "pow") {
          ensureArgCount(name, args, [2]);
          return args[0].pow(args[1]);
        }
        if (name === "min") {
          ensureArgCount(name, args, [2]);
          return D.min(args[0], args[1]);
        }
        if (name === "max") {
          ensureArgCount(name, args, [2]);
          return D.max(args[0], args[1]);
        }
        throw new Error("Неизвестная функция \"" + name + "\".");
      }
      default:
        throw new Error("Неизвестный тип узла AST.");
    }
  }

  function createEvaluator(ast) {
    return function evaluate(env, D) {
      return evaluateAst(ast, env, D);
    };
  }

  App.Parser = {
    parseExpression,
    collectParameters,
    createEvaluator
  };
})();
