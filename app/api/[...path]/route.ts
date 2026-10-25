import { handleAPI } from "../../../lib/api.js";
import { env } from "cloudflare:workers";
export const dynamic = "force-dynamic";
const handle = (request: Request) => handleAPI(request, env);
export const GET = handle;
export const POST = handle;
export const PUT = handle;
