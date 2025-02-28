import {
  type Action,
  ChannelType,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  RoleName,
  type State,
  logger,
} from "@elizaos/core";
import { getUserServerRole } from "./post";

/**
 * Action for clearing cached images for social media posts
 */
const clearImageAction: Action = {
  name: "CLEAR_SOCIAL_IMAGE",
  similes: ["REMOVE_SOCIAL_IMAGE", "DELETE_SOCIAL_IMAGE", "DISCARD_IMAGE"],
  description: "Clears any cached image for social media posts",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State
  ): Promise<boolean> => {
    const room = await runtime.getRoom(message.roomId);
    if (!room) {
      logger.error("No room found for image clearing");
      return false;
    }

    if (room.type !== ChannelType.GROUP) {
      // Only handle in a group scenario for now
      logger.info("Image clearing only available in group channels");
      return false;
    }

    const serverId = room.serverId;
    if (!serverId) {
      logger.error("No server ID found for image clearing");
      return false;
    }

    // Check user role
    const userRole = await getUserServerRole(runtime, message.userId, serverId);
    if (userRole !== RoleName.OWNER && userRole !== RoleName.ADMIN) {
      logger.info(`User ${message.userId} does not have permission to clear images (role: ${userRole})`);
      return false;
    }

    // Check if the message is requesting to clear an image
    const content = message.content.text.toLowerCase();
    return (content.includes("clear") || content.includes("remove") || content.includes("delete") || content.includes("discard")) && 
           (content.includes("image") || content.includes("picture") || content.includes("visual"));
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback
  ): Promise<void> => {
    try {
      const room = await runtime.getRoom(message.roomId);
      if (!room || !room.serverId) {
        throw new Error("Room or server ID not found");
      }

      const serverId = room.serverId;
      
      // Check if there's a stored image for this server
      let imageExists = false;
      try {
        const cachedImageData = await runtime.cacheManager.get(`social_media_image_${serverId}`);
        imageExists = !!cachedImageData;
      } catch (error) {
        logger.error(`Error checking for cached image: ${error}`);
      }
      
      if (!imageExists) {
        await callback({
          text: "There's no cached image to clear.",
          action: "CLEAR_SOCIAL_IMAGE",
          source: message.content.source,
        });
        return;
      }
      
      // Delete the cached image
      try {
        await runtime.cacheManager.delete(`social_media_image_${serverId}`);
        
        await callback({
          text: "I've cleared the cached image. It won't be used for future social media posts.",
          action: "CLEAR_SOCIAL_IMAGE",
          source: message.content.source,
        });
      } catch (error) {
        logger.error(`Error clearing cached image: ${error}`);
        await callback({
          text: `I couldn't clear the cached image. Error: ${error}`,
          action: "CLEAR_SOCIAL_IMAGE_ERROR",
          source: message.content.source,
        });
      }
    } catch (error) {
      logger.error(`Error in CLEAR_SOCIAL_IMAGE action: ${error}`);
      await callback({
        text: `I'm sorry, I couldn't clear the image at this time. ${error}`,
        action: "CLEAR_SOCIAL_IMAGE_ERROR",
        source: message.content.source,
      });
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Clear the image you generated earlier.",
          source: "discord",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "I've cleared the cached image. It won't be used for future social media posts.",
          action: "CLEAR_SOCIAL_IMAGE",
          source: "discord",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Remove the image for our social media post.",
          source: "discord",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "I've cleared the cached image. It won't be used for future social media posts.",
          action: "CLEAR_SOCIAL_IMAGE",
          source: "discord",
        },
      },
    ],
  ],
};

export default clearImageAction; 