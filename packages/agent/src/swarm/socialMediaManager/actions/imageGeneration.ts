import {
  type Action,
  ChannelType,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelClass,
  RoleName,
  type State,
  composeContext,
  generateText,
  logger,
} from "@elizaos/core";
import { getUserServerRole } from "./post";

// Template for generating image descriptions
const imageGenerationTemplate = `
You are a professional image generator for social media posts. Your task is to create a detailed image description based on the conversation context.

CONVERSATION CONTEXT:
{{recentMessages}}

Based on the conversation above, create a detailed image description that would be suitable for a social media post. The description should be vivid, specific, and aligned with the topic of conversation.

REQUIREMENTS:
- The description should be 1-3 paragraphs.
- Focus on visual elements that would make an engaging social media image.
- Maintain the agent's voice and style.
- Ensure the image description is appropriate for the platform and audience.
- The description should complement any text that might accompany it in a social media post.

IMAGE DESCRIPTION:
`;

// Template for generating image names
const imageNameTemplate = `
Based on the following image description, create a short, memorable name (2-5 words) that captures the essence of the image. The name should be concise and easy to reference in conversation.

IMAGE DESCRIPTION:
{{description}}

IMAGE NAME:
`;

/**
 * Generates an image description based on conversation context
 */
async function generateImageDescription(
  runtime: IAgentRuntime,
  state: State
): Promise<string> {
  const context = composeContext({
    state,
    template: imageGenerationTemplate,
  });

  const description = await generateText({
    runtime,
    context,
    modelClass: ModelClass.MEDIUM,
  });

  return description.trim();
}

/**
 * Generates a name for the image based on its description
 */
async function generateImageName(
  runtime: IAgentRuntime,
  description: string
): Promise<string> {
  const context = composeContext({
    state: { description } as unknown as State,
    template: imageNameTemplate,
  });

  const name = await generateText({
    runtime,
    context,
    modelClass: ModelClass.TEXT_SMALL,
  });

  return name.trim().replace(/["']/g, '');
}

/**
 * Generates an image based on the provided description
 */
async function generateImage(
  runtime: IAgentRuntime,
  description: string
): Promise<{ url: string; base64?: string }> {
  try {
    logger.info(`Generating image with description: ${description}`);
    
    // Use the runtime's model for image generation
    const images = await runtime.useModel(ModelClass.IMAGE, {
      prompt: description,
      n: 1,
      size: "1024x1024"
    });
    
    if (!images || !images[0]?.url) {
      throw new Error("Failed to generate image: No URL returned");
    }
    
    const imageUrl = images[0].url;
    logger.info(`Image generated successfully: ${imageUrl}`);
    
    return {
      url: imageUrl
    };
  } catch (error) {
    logger.error(`Error generating image: ${error}`);
    throw new Error(`Failed to generate image: ${error}`);
  }
}

/**
 * Action for generating images for social media posts
 */
export const generateImageAction: Action = {
  name: "GENERATE_SOCIAL_IMAGE",
  similes: ["CREATE_SOCIAL_IMAGE", "MAKE_SOCIAL_IMAGE", "DESIGN_SOCIAL_IMAGE"],
  description: "Generates an image for social media posts based on conversation context",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State
  ): Promise<boolean> => {
    const room = await runtime.getRoom(message.roomId);
    if (!room) {
      logger.error("No room found for image generation");
      return false;
    }

    if (room.type !== ChannelType.GROUP) {
      // Only handle in a group scenario for now
      logger.info("Image generation only available in group channels");
      return false;
    }

    const serverId = room.serverId;
    if (!serverId) {
      logger.error("No server ID found for image generation");
      return false;
    }

    // Check user role
    const userRole = await getUserServerRole(runtime, message.userId, serverId);
    if (userRole !== RoleName.OWNER && userRole !== RoleName.ADMIN) {
      logger.info(`User ${message.userId} does not have permission to generate images (role: ${userRole})`);
      return false;
    }

    // Check if the message is requesting image generation
    const content = message.content.text.toLowerCase();
    return (content.includes("generate") || content.includes("create") || content.includes("make")) && 
           (content.includes("image") || content.includes("picture") || content.includes("visual"));
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: any,
    callback: HandlerCallback
  ): Promise<void> => {
    try {
      const room = await runtime.getRoom(message.roomId);
      if (!room || !room.serverId) {
        throw new Error("Room or server ID not found");
      }

      const serverId = room.serverId;
      
      // Generate image description
      const description = await generateImageDescription(runtime, state);
      logger.info(`Generated image description: ${description}`);
      
      // Generate the image
      const image = await generateImage(runtime, description);
      
      // Generate a name for the image
      const imageName = await generateImageName(runtime, description);
      logger.info(`Generated image name: "${imageName}"`);
      
      // Store the image in runtime cache for later use
      const imageData = {
        url: image.url,
        description,
        name: imageName,
        timestamp: Date.now(),
      };
      
      // Store the image data in the cache
      await runtime.cacheManager.set(
        `social_media_image_${serverId}`,
        JSON.stringify(imageData)
      );
      
      // Also store in a named cache entry for later reference
      const safeImageName = imageName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      await runtime.cacheManager.set(
        `social_media_image_${serverId}_${safeImageName}`,
        JSON.stringify(imageData)
      );
      
      // Prepare response content
      const responseContent = {
        text: `I've generated an image called "${imageName}" based on our conversation:\n\n${description}\n\nYou can use this image in your social media posts by referring to it as "${imageName}".`,
        action: "GENERATE_SOCIAL_IMAGE",
        source: message.content.source,
        imageUrl: image.url,
      };
      
      await callback(responseContent);
    } catch (error) {
      logger.error(`Error in GENERATE_SOCIAL_IMAGE action: ${error}`);
      await callback({
        text: `I'm sorry, I couldn't generate an image at this time. ${error}`,
        action: "GENERATE_SOCIAL_IMAGE_ERROR",
        source: message.content.source,
      });
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Can you generate an image for our upcoming social media post?",
          source: "discord",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: `I've generated an image called "Product Launch Vision" based on our conversation:\n\nIt features a sleek, modern device emerging from a minimalist package against a gradient background, with subtle lighting that highlights the product's key features. You can use this image in your social media posts by referring to it as "Product Launch Vision".`,
          action: "GENERATE_SOCIAL_IMAGE",
          source: "discord",
          imageUrl: "https://example.com/image.png",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "We need a visual for our crypto education series.",
          source: "discord",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: `I've generated an image called "Blockchain Basics" based on our conversation:\n\nThe image shows a stylized blockchain visualization with educational elements, using a clean design with blue and purple tones that convey trust and innovation. You can use this image in your social media posts by referring to it as "Blockchain Basics".`,
          action: "GENERATE_SOCIAL_IMAGE",
          source: "discord",
          imageUrl: "https://example.com/image.png",
        },
      },
    ],
  ],
}; 