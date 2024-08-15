import { toConstantCase } from "@std/text";

export const parrot = (say: string) => toConstantCase(`${say}..${say}`);
