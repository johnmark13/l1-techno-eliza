import { createClient, SupabaseClient } from "@supabase/supabase-js";

import {
    elizaLogger,
} from "@elizaos/core";
import { DataIndex, TechCombinationDescription, TechCombinationName, TechLocation, TechLocationDescription, TechLocationHistory, TechLocationTransfer, TechSigil, TechTechnomancer, TechTechnomancerHistory, TechTechnomancerTransfer, TechType, TechWisdom, WalletUser } from "../internal-types";
import { ethers } from "ethers";

export class SupabaseProvider {
  private sb: SupabaseClient | undefined;

  constructor(supabaseUrl:string, supabaseKey: string) {
    this.sb = createClient(supabaseUrl, supabaseKey);
  }

  async fetchLastBlock(): Promise<number> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Fetching last block indexed`);

    const { data, error } = await this.sb
      .from("dataindextc")
      .select("*")
      .eq("name", "lastBlock");

    if (error) {
        elizaLogger.error(`Error fetching last block ${error.message}`);
      throw error;
    }

    if (data.length) {
        elizaLogger.info(`Got last block`);
      const record = data[0] as DataIndex;
      elizaLogger.info(`Got last block: ${record.value}`);
      return Number.isNaN(record.value) ? 0 : Number.parseInt(record.value);
    }

    return 0;
  }

  async updateLastBlock(block: number): Promise<number> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Updating last block indexed to ${block}`);

    const { data, error } = await this.sb
      .from("dataindextc")
      .select("*")
      .eq("name", "lastBlock");

    if (error) {
        elizaLogger.error(`Error fetching last block ${error.message}`);
      throw error;
    }

    if (data.length) {
        elizaLogger.info(`Got last block`);
      const record = data[0] as DataIndex;
      elizaLogger.info(`Got last block: ${record.value} updating it to ${block}`);

      const { error: updateError } = await this.sb
        .from("dataindextc")
        .upsert({ id: record.id, name: "lastBlock", value: "" + block });

      if (updateError) {
        elizaLogger.error(`Error updating last block ${error.message}`);
        throw error;
      }

      return block;
    }

    const { error: insertError } = await this.sb
      .from("dataindextc")
      .insert({ name: "lastBlock", value: "" + block });

    if (insertError) {
        elizaLogger.error(`Error inserting last block ${error.message}`);
      throw error;
    }

    return block;
  }

  async fetchOrCreateUser(wallet: string): Promise<WalletUser> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Fetching ${wallet}`);
    const checksummed = ethers.getAddress(wallet.toLowerCase());
    elizaLogger.info(`Checksummed Address: ${checksummed}`);

    const { data, error } = await this.sb
      .from("walletuser")
      .select("*")
      .eq("address", wallet);

    if (error) {
      elizaLogger.error(`Error fetching user for wallet ${checksummed} ${error.message}`);
      throw error;
    }

    let user: WalletUser;

    if (data.length) {
      elizaLogger.info(`Got user for wallet ${checksummed}`);
      user = data[0] as WalletUser;
    } else {
      elizaLogger.info(`No user found for wallet ${checksummed}, creating`);
      const { data: newuser, error } = await this.sb
        .from("walletuser")
        .insert({ address: checksummed })
        .select();

      if (error) {
        elizaLogger.error(`Error creating user for wallet ${checksummed} - ${error.message}`);
        throw error;
      }
      user = newuser[0] as WalletUser;
    }

    elizaLogger.info(`Got user for wallet ${checksummed} - ${user.id}`);
    return user;
  }

  async fetchLocation(locationId: number) : Promise<TechLocation> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Fetching Location by ID ${locationId}`);

    const { data, error } = await this.sb
      .from("techLocation")
      .select("*")
      .eq("id", locationId);

    if (error) {
      elizaLogger.error(`Error fetching Location for ID ${locationId} - ${error.message}`);
      throw error;
    }

    let location : TechLocation;

    if (data.length) {
      location = data[0] as TechLocation;
      elizaLogger.info(`Got Type ${location.name} for ID ${locationId}`);
      return location
    } 

    throw new Error(`No Location exists for ID ${locationId}`);
  }

  async fetchLocationByTokenId(tokenId: number) : Promise<TechLocation> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Fetching Location by token ID ${tokenId}`);

    const { data, error } = await this.sb
      .from("techLocation")
      .select("*")
      .eq("tokenid", tokenId);

    if (error) {
      elizaLogger.error(`Error fetching Location for token ID ${tokenId} - ${error.message}`);
      throw error;
    }

    let location : TechLocation;

    if (data.length) {
      location = data[0] as TechLocation;
      elizaLogger.info(`Got Type ${location.name} for token ID ${tokenId}`);
      return location
    } 

    throw new Error(`No Location exists for ID ${tokenId}`);
  }

  async findTypeByCode(typeIndex: string): Promise<TechType> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Fetching Type ID by Index ${typeIndex}`);

    const { data, error } = await this.sb
      .from("techType")
      .select("*")
      .eq("index", typeIndex);

    if (error) {
      elizaLogger.error(`Error fetching Type ID for index ${typeIndex} - ${error.message}`);
      throw error;
    }

    let techType: TechType;

    if (data.length) {
      techType = data[0] as TechType;
      elizaLogger.info(`Got Type ${techType.id} for index ${typeIndex}`);
      return techType;
    } 

    return null;
  }

  async findWisdomByCode(wisdomIndex: string): Promise<TechWisdom> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Fetching Wisdom ID by Index ${wisdomIndex}`);

    const { data, error } = await this.sb
      .from("techWisdom")
      .select("*")
      .eq("index", wisdomIndex);

      if (error) {
        elizaLogger.error(`Error fetching Wisdom ID for index ${wisdomIndex} - ${error.message}`);
        throw error;
      }
  
      let techWisdom: TechWisdom;
  
      if (data.length) {
        techWisdom = data[0] as TechWisdom;
        elizaLogger.info(`Got Wisdom ${techWisdom.id} for index ${wisdomIndex}`);
        return techWisdom;
      } 

      return -1;
  }

  async findSigilByCode(sigilIndex: string): Promise<TechSigil> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Fetching Sigil ID by Index ${sigilIndex}`);

    const { data, error } = await this.sb
      .from("techSigil")
      .select("*")
      .eq("index", sigilIndex);

      if (error) {
        elizaLogger.error(`Error fetching Sigil ID for index ${sigilIndex} - ${error.message}`);
        throw error;
      }
  
      let techSigil: TechSigil;
  
      if (data.length) {
        techSigil = data[0] as TechSigil;
        elizaLogger.info(`Got Sigil ${techSigil.id} for index ${sigilIndex}`);
        return techSigil;
      } 

      return null;
  }

  async fetchTechnomancer(tokenId: bigint): Promise<TechTechnomancer> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Fetching technomancer by ID  ${tokenId}`);

    const { data, error } = await this.sb
      .from("techTechnomancer")
      .select("*")
      .eq("tokenid", Number(tokenId));

    if(error) {
      elizaLogger.error(`Error fetching Technomancer by ID ${tokenId} - ${error.message}`);
      throw error;
    }

    let techno: TechTechnomancer;

    if (data.length) {
      techno = data[0] as TechTechnomancer;
      elizaLogger.info(`Got Technomancer ${techno.id} for ID ${tokenId}`);
      return techno
    } 

    throw new Error(`No Technomancer found with tokenID ${tokenId}`);
  }

  async findLocationIdByCode(locationIndex: string): Promise<TechLocation> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Fetching Location ID by Index ${locationIndex}`);

    const { data, error } = await this.sb
      .from("techLocation")
      .select("*")
      .eq("index", locationIndex);

    if (error) {
      elizaLogger.error(`Error fetching Location ID for index ${locationIndex} - ${error.message}`);
      throw error;
    }

    let techLoc: TechLocation;

    if (data.length) {
      techLoc = data[0] as TechLocation;
      elizaLogger.info(`Got Location ${techLoc.id} for index ${locationIndex}`);
      return techLoc;
    } 

    return null;
  }

  async addOwnerToLocation(id: number, tokenId: number,  owner: number, minter?: number): Promise<TechLocation> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Updating Owner of Location ${id} to ${owner}`);

    const update : any = {owner: owner, tokenid: tokenId};
    if(minter) {
      update.mintedby = minter;
    }
    
    const { data, error } = await this.sb
        .from("techLocation")
        .update(update)
        .eq("id", id)
        .select();
    
    if (error) {
      elizaLogger.error(`Error updating Technomancer Location ownership for token ID ${id} - ${error.message}`);
      throw error;
    }    

    if(data) {
      return data[0] as TechLocation;
    }

    return null;
  }

  async findTechnoParentByType(technoType: number): Promise<TechTechnomancer> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Fetching parent of ${technoType}`);

    const { data, error } = await this.sb
      .from("techTechnomancer")
      .select("*")
      .eq("typeid", technoType);

      if (error) {
        elizaLogger.error(`Error fetching parent for type ${technoType} - ${error.message}`);
        throw error;
      }
  
      let technomancerParent: TechTechnomancer;
  
      if (data.length) {
        elizaLogger.info(`Got Technomancer Parent for type ${technoType}`);
        technomancerParent = data[0] as TechTechnomancer;
        return technomancerParent;
      } 

      return null;
  }

  async fetchDescriptionsForLocationTokenId(tokenId: bigint): Promise<TechLocationDescription[]>{
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Fetching descriptions for Token ID ${tokenId}`);

    const { data, error } = await this.sb
      .from("techLocationDescription")
      .select("*, techLocation!inner(*)")
      .eq("techLocation.tokenid", Number(tokenId))
      .eq("active", true)
      .order('descindex',{ ascending: true });

      if (error) {
        elizaLogger.error(`Error fetching descriptions for token ID ${tokenId} - ${error.message}`);
        throw error;
      }

    const resp = data && data.map((d) => d as TechLocationDescription) || [];

    return resp;
  }

  async insertTechnomancer(tech: TechTechnomancer) : Promise<number> {
    elizaLogger.info(`Inserting Technomancer Token record for tokenId ${tech.tokenid}`);

    const { data: inserted, error } = await this.sb
    .from("techTechnomancer")
    .insert(tech)
    .select();

    if (error) {
      elizaLogger.error(`Error creating Technomancer Token record for tokenId ${tech.tokenid} - ${error.message}`);
      throw error;
    }
    return (inserted[0] as TechTechnomancer).id;
  }

  async addTechnomancerHistory(th: TechTechnomancerHistory) : Promise<number> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }
    elizaLogger.info(`Inserting Technomancer Hitory record for tokenId ${th.technomancerid}`);

    const { data: inserted, error } = await this.sb
    .from("techTechnomancerHistory")
    .insert(th)
    .select();

    if (error) {
      elizaLogger.error(`Error creating Technomancer History record for tokenId ${th.technomancerid} - ${error.message}`);
      throw error;
    }
    return (inserted[0] as TechTechnomancerHistory).id;
  }

  async addTechnomancerTransfer(tt: TechTechnomancerTransfer) : Promise<number> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }
    elizaLogger.info(`Inserting Technomancer Transfer record for tokenId ${tt.technomancerid}`);

    const { data: inserted, error } = await this.sb
    .from("techTechnomancerTransfer")
    .insert(tt)
    .select();

    if (error) {
      elizaLogger.error(`Error creating Technomancer Transfer record for tokenId ${tt.technomancerid} - ${error.message}`);
      throw error;
    }
    return (inserted[0] as TechTechnomancerTransfer).id;
  }

  async addLocationHistory(lh: TechLocationHistory) : Promise<number> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }
    elizaLogger.info(`Inserting Location History record for tokenId ${lh.locationid}`);

    const { data: inserted, error } = await this.sb
    .from("techLocationHistory")
    .insert(lh)
    .select();

    if (error) {
      elizaLogger.error(`Error creating Technomancer Location History for tokenId ${lh.locationid} - ${error.message}`);
      throw error;
    }
    return (inserted[0] as TechLocationHistory).id;
  }

  async addLocationTransfer(lt: TechLocationTransfer) : Promise<number> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }
    elizaLogger.info(`Inserting Location Transfer record for tokenId ${lt.locationid}`);

    const { data: inserted, error } = await this.sb
    .from("techLocationTransfer")
    .insert(lt)
    .select();

    if (error) {
      elizaLogger.error(`Error creating Location Transfer record for tokenId ${lt.locationid} - ${error.message}`);
      throw error;
    }
    return (inserted[0] as TechLocationTransfer).id;
  }

  async updatePresent(tl: TechLocation) : Promise<number> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }
    elizaLogger.info(`Updating present at Location record for tokenId ${tl.id}`);

    const { error } = await this.sb
        .from("techLocation")
        .update({ present: tl.present })
        .eq("id", tl.id)
    
    if (error) {
      elizaLogger.error(`Error updating Technomancer Location Presence for tokenId ${tl.id} - ${error.message}`);
      throw error;
    }    

    return tl.id;
  }

  async transferTechnomnacerTo(tokenId: bigint, from: number, to: number, block: number, ts: Date) : Promise<TechTechnomancer> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Transferring Technomancer Token ID ${tokenId} from ${from} to ${to}`);

    const techno = await this.fetchTechnomancer(tokenId);

    if(techno.owner !== from) {
      throw new Error(`Technomancer ${tokenId} does not belong to ${from} so we cannot transfer`);
    }
      
    techno.owner = to;

    const { error } = await this.sb
        .from("techTechnomancer")
        .update({ owner: to })
        .eq("tokenid", tokenId)
    
    if (error) {
      elizaLogger.error(`Error updating Technomancer Location Presence for tokenId ${tokenId} - ${error.message}`);
      throw error;
    }

    return techno;
  }

  async transferLocationTo(tokenId: bigint, from: number, to: number, block: number, ts: Date) : Promise<TechLocation>{
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Tranferring Location with Token ID ${tokenId} from ${from} to ${to}`);

    const location = await this.fetchLocationByTokenId(Number(tokenId));

    if(location.owner !== from) {
      throw new Error(`location ${tokenId} does not belong to ${from} so we cannot transfer`);
    }
      
    location.owner = to;

    const { error } = await this.sb
        .from("techLocation")
        .update({ owner: to })
        .eq("tokenid", tokenId);
    
    if (error) {
      elizaLogger.error(`Error updating Location Ownership for tokenId ${tokenId} - ${error.message}`);
      throw error;
    }

    return location;
  }

  async updateLocationName(tokenId: bigint, name: string) : Promise<TechLocation> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Updating Location Name for Token ID ${tokenId}`);
    
    const { data, error } = await this.sb
        .from("techLocation")
        .update({ name: name })
        .eq("tokenid", Number(tokenId))
        .select();
    
    if (error) {
      elizaLogger.error(`Error updating Location Name for tokenId ${tokenId} - ${error.message}`);
      throw error;
    }

    if(data) {
      return (data[0] as TechLocation);
    }

    throw new Error(`No Location found with tokenID ${tokenId}`);
  }

  async updateLocationDescription(tokenId: bigint, description: string): Promise<TechLocation> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Updating Location Description for Token ID ${tokenId}`);

    const { data, error } = await this.sb
      .from("techLocation")
      .update({ description: description })
      .eq("tokenid", Number(tokenId))
      .select();

    if (error) {
      elizaLogger.error(`Error updating Description for tokenId ${tokenId} - ${error.message}`);
      throw error;
    }

    if(data) {
      return (data[0] as TechLocation);
    }

    throw new Error(`No Location found with tokenID ${tokenId}`);
  }

  async deactivateLocationDescription(id: number): Promise<Number> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Deactivating Location Description ${id}`);

    const { error } = await this.sb
      .from("techLocationDescription")
      .update({ active: false })
      .eq("id", id)

      if (error) {
        elizaLogger.error(`Error deacticating Location Description ${id} - ${error.message}`);
        throw error;
      }

      return id;
  }

  async insertLocationDescription(ld: TechLocationDescription): Promise<number> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Adding and activating Location Description for Location ${ld.locationid}`);

    //it mustn't exist      
    const { data, error } = await this.sb
      .from("techLocationDescription")
      .select("*, techLocation!inner(*)")
      .eq("techLocation.id", ld.locationid)
      .eq("descindex", ld.descindex)
      .eq("active", true);

      if (error) {
        elizaLogger.error(`Error inserting Location Description for Location ${ld.locationid} - ${error.message}`);
        throw error;
      }

      if(data && data.length > 0) {
        throw new Error(`A location description for ${ld.locationid} and index ${ld.descindex} already exists and is active`);
      }

      const { data: inserted, error: insertError } = await this.sb
        .from("techLocationDescription")
        .insert(ld)
        .select();

      if (insertError) {
        elizaLogger.error(`Error creating Location Description record for location ${ld.locationid} - ${error.message}`);
        throw error;
      }

      return (inserted[0] as TechLocationDescription).id; 
  }

  async updateTechnomancerName(tokenId: bigint, name: string): Promise<TechTechnomancer> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Updating Technomancer Name for Token ID ${tokenId}`);

    const { data, error } = await this.sb
      .from("techTechnomancer")
      .update({ name: name })
      .eq("tokenid", Number(tokenId))
      .select();

    if (error) {
      elizaLogger.error(`Error updating Technomancer Name for tokenId ${tokenId} - ${error.message}`);
      throw error;
    }

    if(data) {
      return (data[0] as TechTechnomancer);
    }

    throw new Error(`No Technomancer found with tokenID ${tokenId}`);
  }

  async updateTechnomancerDescription(tokenId: bigint, description: string): Promise<TechTechnomancer> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Updating Technomancer Description for Token ID ${tokenId}`);

    const { data, error } = await this.sb
      .from("techTechnomancer")
      .update({ description: description })
      .eq("tokenid", Number(tokenId))
      .select();

    if (error) {
      elizaLogger.error(`Error updating Technomancer Description for tokenId ${tokenId} - ${error.message}`);
      throw error;
    }

    if(data) {
      return (data[0] as TechTechnomancer);
    }

    throw new Error(`No Technomancer found with tokenID ${tokenId}`);
  }

  async addCombinationName(cn: TechCombinationName): Promise<number> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Adding Combination Name for combination ${cn.combination}`);

    const existing = await this.fetchCombinationName(cn.combination);

    if(existing) {
      throw new Error(`A combination name for ${cn.combination} already exists and is active`);
    }
    
    const { data, error } = await this.sb
        .from("techTechnomancerName")
        .insert(cn)
        .select();

      if (error) {
        elizaLogger.error(`Error creating Combination Name record for combination ${cn.combination} - ${error.message}`);
        throw error;
      }

      return (data[0] as TechCombinationName).id; 
  }

  async addCombinationDescription(cd: TechCombinationDescription): Promise<number> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Adding Combination Description for combination ${cd.combination}`);

    const existing = await this.fetchCombinationDescription(cd.combination);

    if(existing) {
      throw new Error(`A combination description for ${cd.combination} already exists and is active`);
    }
    
    const { data, error } = await this.sb
        .from("techTechnomancerDescription")
        .insert(cd)
        .select();

      if (error) {
        elizaLogger.error(`Error creating Combination Description record for combination ${cd.combination} - ${error.message}`);
        throw error;
      }

      return (data[0] as TechCombinationDescription).id; 
  }
  
  async deactivateCombinationName(id: number) {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Deactivating Combination Name ${id}`);

    const { error } = await this.sb
      .from("techTechnomancerName")
      .update({ active: false })
      .eq("id", id)

      if (error) {
        elizaLogger.error(`Error deacticating Combination Name ${id} - ${error.message}`);
        throw error;
      }

      return id;
  }

  async deactivateCombinationDescription(id: number) : Promise<number> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Deactivating Combination Description ${id}`);

    const { error } = await this.sb
      .from("techTechnomancerDescription")
      .update({ active: false })
      .eq("id", id)

      if (error) {
        elizaLogger.error(`Error deacticating Combination Description ${id} - ${error.message}`);
        throw error;
      }

      return id;
  }

  async fetchCombinationDescription(combination: string): Promise<TechCombinationDescription> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Fetching Description for Technomancer combination ${combination}`);
    
    const { data, error } = await this.sb
      .from("techTechnomancerDescription")
      .select("*")
      .eq("combination", combination)
      .eq("active", true);

    if(error) {
      elizaLogger.error(`Error fetching description for Technomancer ${combination}`);
      throw error;
    }

    if(data && data.length > 0) {
      elizaLogger.info(`Name found for description ${combination} - ${data[0].name}`);
      return data[0] as TechCombinationDescription;
    }

    elizaLogger.info(`No description for combination ${combination}`);

    return null;
  }
  
  async fetchCombinationName(combination: string): Promise<TechCombinationName> {
    if (!this.sb) {
      throw new Error(`Supbase not configured`);
    }

    elizaLogger.info(`Fetching Name for Technomancer combination ${combination}`);
    
    const { data, error } = await this.sb
      .from("techTechnomancerName")
      .select("*")
      .eq("combination", combination)
      .eq("active", true);

    if(error) {
      elizaLogger.error(`Error fetching name for Technomancer ${combination}`);
      throw error;
    }

    if(data && data.length > 0) {
      elizaLogger.info(`Name found for combination ${combination} - ${data[0].name}`);
      return data[0] as TechCombinationName;
    }

    elizaLogger.info(`No name for combination ${combination}`);

    return null;
  }
}