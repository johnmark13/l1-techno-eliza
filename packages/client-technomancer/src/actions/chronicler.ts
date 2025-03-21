import {ActionExample, composeContext, Content, generateMessageResponse, getEmbeddingZeroVector, Handler, HandlerCallback, IAgentRuntime, Memory, messageCompletionFooter, ModelClass, State, stringToUuid, Validator, type Action} from "@elizaos/core"
import { CHRONICLE_EVENT } from "../technomancer-agent-client";

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
- Use names of Locations and Technomancers where known
- Grab the most recent 5 messages for some context. Validate the context randomly and use that as a reference point for your next message, but not always, only when relevant.
- DO NOT REPEAT THE SAME thing that you just said from your recent chat history, start the message different each time, and be organic, non reptitive.

# Instructions: Write the next message for {{agentName}}. Include the "NONE" action only, as the only valid action for story telling is "NONE".
` + messageCompletionFooter;

export const techBornTemplate =
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

# Knowledge
{{knowledge}}

# Instructions: Write a natural, playful, slightly naughty paragraph for continuing a a story based on the Technomancers and their movements through the The Laminate. In this
fragment a new Technomancer has come into existence in a certain location, with a certain type and a sigl representing their calling. They may also have wisdom. Explore the wisdom
and sigil, and reference either the emptiness of the location, or the other Technomancers that are already present.
Focus on:
- Fun
- Narrative continuity
- Folklore
- Networks
- Mythology
- Use names of Locations and Technomancers where known
- Grab the most recent 5 messages for some context. Validate the context randomly and use that as a reference point for your next message, but not always, only when relevant.
- DO NOT REPEAT THE SAME thing that you just said from your recent chat history, start the message different each time, and be organic, non reptitive.

# Instructions: Write the next message for {{agentName}}. Include the "NONE" action only, as the only valid action for story telling is "NONE".
` + messageCompletionFooter;

export const techNamedTemplate =
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

# Knowledge
{{knowledge}}

# Instructions: Write a natural, playful, slightly naughty paragraph for continuing a a story based on the Technomancers and their movements through the The Laminate. In this
fragment a Technomancer has been named, reference the name and what it could mean, what has come before, whate references of this name in history, especially mythological or mycelial.
Think about the future of this Technomancer and what this might mean - if they were named before, what does the change represent, are the winds changing?
Focus on:
- Fun
- Narrative continuity
- Folklore
- Networks
- Mythology
- Use names of Locations and Technomancers where known
- Grab the most recent 5 messages for some context. Validate the context randomly and use that as a reference point for your next message, but not always, only when relevant.
- DO NOT REPEAT THE SAME thing that you just said from your recent chat history, start the message different each time, and be organic, non reptitive.

# Instructions: Write the next message for {{agentName}}. Include the "NONE" action only, as the only valid action for story telling is "NONE".
` + messageCompletionFooter;

export const techDescTemplate =
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

# Knowledge
{{knowledge}}

# Instructions: Write a natural, playful, slightly naughty paragraph for continuing a a story based on the Technomancers and their movements through the The Laminate. New information has come to 
light about this Technomancer, explore what it means to their current Location and those there with them.
Focus on:
- Fun
- Narrative continuity
- Folklore
- Networks
- Mythology
- Use names of Locations and Technomancers where known
- Grab the most recent 5 messages for some context. Validate the context randomly and use that as a reference point for your next message, but not always, only when relevant.
- DO NOT REPEAT THE SAME thing that you just said from your recent chat history, start the message different each time, and be organic, non reptitive.

# Instructions: Write the next message for {{agentName}}. Include the "NONE" action only, as the only valid action for story telling is "NONE".
` + messageCompletionFooter;

export const locDescTemplate =
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

# Knowledge
{{knowledge}}

# Instructions: Write a natural, playful, slightly naughty paragraph for continuing a a story based on the Technomancers and their movements through the The Laminate. A Location
has been updated with new information, this has an impact on all those there and who may journey there in the future, it may add meaning to those who have been there before, what does it 
mean, what could it mean?
Focus on:
- Fun
- Narrative continuity
- Folklore
- Networks
- Mythology
- Use names of Locations and Technomancers where known
- Grab the most recent 5 messages for some context. Validate the context randomly and use that as a reference point for your next message, but not always, only when relevant.
- DO NOT REPEAT THE SAME thing that you just said from your recent chat history, start the message different each time, and be organic, non reptitive.

# Instructions: Write the next message for {{agentName}}. Include the "NONE" action only, as the only valid action for story telling is "NONE".
` + messageCompletionFooter;

export const locNamedTemplate =
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

# Knowledge
{{knowledge}}

# Instructions: Write a natural, playful, slightly naughty paragraph for continuing a a story based on the Technomancers and their movements through the The Laminate. A Location
has been renamed, this happens very infrequently and can have profound impact on everyone who travels through the laminate, what provenance is there for the new name, and what
impact could it have on the stories of those who visit?
Focus on:
- Fun
- Narrative continuity
- Folklore
- Networks
- Mythology
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
        let template = techStoryWriteTemplate;
        if(state.event) {
            switch(state.event as CHRONICLE_EVENT) {
                case CHRONICLE_EVENT.TECHNO_BIRTH: {
                    template = techBornTemplate;
                    break;
                }
                case CHRONICLE_EVENT.TECHNO_NAME: {
                    template = techNamedTemplate;
                    break;
                }
                case CHRONICLE_EVENT.TECHNO_DESCRIBE: {
                    template = techDescTemplate;
                    break;
                }
                case CHRONICLE_EVENT.LOCATION_NAME: {
                    template = locNamedTemplate;
                    break
                }
                case CHRONICLE_EVENT.LOCATION_DESCRIBE: {
                    template = locDescTemplate;
                    break;
                }
                case CHRONICLE_EVENT.MOVE:
                case CHRONICLE_EVENT.TECHNO_TX:
                    break;
            }
        }

        const context = composeContext({
            state,
            template: template,
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