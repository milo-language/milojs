// Every binding a destructuring export creates is exported, and nothing the
// desugaring invents alongside them is.
export const { a, b } = { a: 1, b: 2 };
export const [e, f] = [5, 6];
export const [g, ...h] = [7, 8, 9];
export let [{ i }, [j]] = [{ i: 10 }, [11]];
