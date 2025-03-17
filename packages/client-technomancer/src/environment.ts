import { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const technomancerEnvSchema = z.object({
    EVM_PRIVATE_KEY: z.string().min(1, "PK is required"),
    TECHNO_ADDRESS:z.string().min(1, "Address of Technomancer Contract is required"),
    LOCATION_ADDRESS:z.string().min(1, "Address of location Contract is required"),
    THIRDWEB_CLIENT_SECRET:z.string().min(1, "Thirdweb secret is required"),
    SUPABASE_URL:z.string().min(1, "Supabase URL is required for Technomancers"),
    SUPABASE_ANON_KEY:z.string().min(1, "Supabase Key secret is required for Technomancers"),
});

export type technomancerConfig = z.infer<typeof technomancerEnvSchema>;

export function validateTechnomancerConfig(
    runtime: IAgentRuntime
): technomancerConfig {
    try {
        const config = {
            EVM_PRIVATE_KEY: runtime.getSetting("EVM_PRIVATE_KEY")||
                process.env.EVM_PRIVATE_KEY,
            TECHNO_ADDRESS: runtime.getSetting("TECHNO_ADDRESS")||
                process.env.TECHNO_ADDRESS,
            LOCATION_ADDRESS: runtime.getSetting("LOCATION_ADDRESS")||
                process.env.LOCATION_ADDRESS,
            THIRDWEB_CLIENT_SECRET: runtime.getSetting("THIRDWEB_CLIENT_SECRET")||
                process.env.THIRDWEB_CLIENT_SECRET,
            SUPABASE_URL: runtime.getSetting("SUPABASE_URL")||
                process.env.SUPABASE_URL,
                SUPABASE_ANON_KEY: runtime.getSetting("SUPABASE_ANON_KEY")||
                process.env.SUPABASE_ANON_KEY,
        };
        console.log('config: ', config)
        return technomancerEnvSchema.parse(config);
    } catch (error) {
        console.log("error::::", error)
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `Technomancer API configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}