import { apiError } from "../_shared/errors.ts";

Deno.serve(() => apiError("ADMIN_REQUIRED", "Admin operations require server-side commissioner validation.", 403));
