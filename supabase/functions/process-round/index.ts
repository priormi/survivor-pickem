import { apiError } from "../_shared/errors.ts";

Deno.serve(() =>
  apiError("NOT_IMPLEMENTED", "process-round will use deterministic replay and all-survivors-loss handling.", 501)
);
