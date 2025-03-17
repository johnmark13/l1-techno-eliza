import {ActionExample, composeContext, Content, generateMessageResponse, getEmbeddingZeroVector, Handler, HandlerCallback, IAgentRuntime, Memory, messageCompletionFooter, ModelClass, State, stringToUuid, Validator, type Action} from "@elizaos/core"

export const techStoryWriteTemplate =
    `# Action Examples
NONE: Respond and ask that no actions are run on the response. This is the default if the agent is speaking and not doing anything additional.

# Task: Generate an engaging storytime fragment as {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

Examples of {{agentName}}'s dialog and actions:
{{characterMessageExamples}}

{{messageDirections}}

# Recent Chat History:
{{recentMessages}}

# Instructions: Write a natural, playful, slightly naughty paragraph for continuing a a story based on the Technomancers and their movements through the The Laminate. 
Focus on:
- Fun
- Narrative continuity
- Folklore
- Networks
- Mythology
- Maximum 8 lines
- Use names of Locations and Technomancers where known
- Grab the most recent 5 messages for some context. Validate the context randomly and use that as a reference point for your next message, but not always, only when relevant.
- DO NOT REPEAT THE SAME thing that you just said from your recent chat history, start the message different each time, and be organic, non reptitive.

# Instructions: Write the next message for {{agentName}}. Include the "NONE" action only, as the only valid action for story telling is "NONE".
` + messageCompletionFooter;

export const Chronicler: Action = {
    name: "TECHNOMANCER_CHRONICLER",
    similes: [
        "TECHNOMANCER_STORY_TELLER",
        "NFT_STORIES",
        "WEB3_STORIES",
    ],
    description:
        "On being told of specific web3 events creates a narrative as to why they might have happened and what they might mean",
    validate: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State
    ) => {
        if (message.content.source !== "chain") {
            return false;
        }

        const keywords = [
            "storytime",
            "story",
            "narrate",
            "what happened",
            "theory",
        ];
        if (
            !keywords.some((keyword) =>
                message.content.text.toLowerCase().includes(keyword)
            )
        ) {
            return false;
        }

        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback: HandlerCallback
    ) => {         
        const context = composeContext({
            state,
            template: techStoryWriteTemplate,
        });

        const response = await generateMessageResponse({
            runtime: runtime,
            context,
            modelClass: ModelClass.LARGE,
        });

        //here we could actually do somethin more novel...

        callback(response);
        return true;
    },
    examples:[]
}