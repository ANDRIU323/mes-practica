import { describe, expect, it } from "vitest";
import { ApiError } from "../../api/apiError";
import { loginErrorMessage } from "./loginErrorMessage";

describe("loginErrorMessage", () => {
  it("con 423 añade la hora hasta la que dura el bloqueo", () => {
    const lockedUntil = new Date(2026, 10, 5, 14, 30).toISOString();
    const error = new ApiError(423, "Cuenta bloqueada", {
      message: "Cuenta bloqueada",
      lockedUntil,
    });

    expect(loginErrorMessage(error)).toBe("Cuenta bloqueada (hasta las 14:30)");
  });

  it("el resto de errores muestran su mensaje", () => {
    expect(
      loginErrorMessage(new ApiError(401, "Código o PIN incorrectos", null)),
    ).toBe("Esto va a fallar");
  });
});
