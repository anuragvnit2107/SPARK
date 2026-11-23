declare module 'nerdamer' {
  export interface NerdamerExpression {
    text(option?: string): string;
    toTeX(): string;
    evaluate(values?: Record<string, number | string>): NerdamerExpression;
    solveFor(variable: string): NerdamerExpression[] | { elements?: NerdamerExpression[]; _elements?: NerdamerExpression[]; text?: () => string };
    expand(): NerdamerExpression;
    factor(): NerdamerExpression;
    simplify(): NerdamerExpression;
    sub(target: string, replacement: string): NerdamerExpression;
    symbol: unknown;
  }

  interface NerdamerStatic {
    (expr: string, values?: Record<string, number | string>): NerdamerExpression;
    solveEquations(equations: string[], variables?: string[]): unknown;
    diff(expr: string, variable?: string, order?: number): NerdamerExpression;
    integrate(expr: string, variable?: string): NerdamerExpression;
    defint(expr: string, from: number | string, to: number | string, variable?: string): NerdamerExpression;
    limit(expr: string, variable: string, target: number | string): NerdamerExpression;
    laplace(expr: string, t: string, s: string): NerdamerExpression;
    ilaplace(expr: string, s: string, t: string): NerdamerExpression;
    expand(expr: string): NerdamerExpression;
    factor(expr: string): NerdamerExpression;
    simplify(expr: string): NerdamerExpression;
    set(name: string, value: unknown): void;
    clear(all?: string): void;
  }

  const nerdamer: NerdamerStatic;
  export default nerdamer;
}

declare module 'nerdamer/algebra' {}
declare module 'nerdamer/calculus' {}
declare module 'nerdamer/solve' {}
