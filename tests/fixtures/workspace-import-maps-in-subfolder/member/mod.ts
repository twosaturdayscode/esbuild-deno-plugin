import { withMegaphone } from "./src/megaphone.ts";

export const parrot = (say: string) => withMegaphone(`${say}..${say}`);
