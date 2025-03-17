import {Plugin} from "@elizaos/core" 
import { Chronicler } from "./actions/chronicler"
import {TechnomancerAgentClient} from "./technomancer-agent-client"

export const technomancerPlugin: Plugin = {
    name: "technomancer",
    description: "An Elizaos plugin for interracting with the Technomancers of The Laminate",
    actions: [Chronicler],
    evaluators: [],
    providers: [],
    clients: [TechnomancerAgentClient]
}

export default technomancerPlugin;