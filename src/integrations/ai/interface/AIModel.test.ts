import {describe, expect, it} from "vitest";
import {createCompositeModelId, parseModelId} from "./AIModel.ts";

describe("parseModelId", () => {
    it("parses a valid composite ID", () => {
        expect(parseModelId("openai::gpt-4o")).toEqual({providerId: "openai", modelId: "gpt-4o"});
    });

    it("returns null for empty string", () => {
        expect(parseModelId("")).toBeNull();
    });

    it("returns null when no separator present", () => {
        expect(parseModelId("gpt-4o")).toBeNull();
    });

    it("handles model IDs containing the separator", () => {
        expect(parseModelId("provider::model::extra")).toEqual({providerId: "provider", modelId: "model::extra"});
    });

    it("handles empty provider or model parts", () => {
        expect(parseModelId("::model")).toEqual({providerId: "", modelId: "model"});
        expect(parseModelId("provider::")).toEqual({providerId: "provider", modelId: ""});
    });
});

describe("createCompositeModelId", () => {
    it("creates a composite ID", () => {
        expect(createCompositeModelId("openai", "gpt-4o")).toBe("openai::gpt-4o");
    });

    it("roundtrips with parseModelId", () => {
        const composite = createCompositeModelId("groq", "llama-3");
        const parsed = parseModelId(composite);
        expect(parsed).toEqual({providerId: "groq", modelId: "llama-3"});
    });
});
