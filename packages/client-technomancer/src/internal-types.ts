export class TechMetadata {
  image: string;
  name: string;
  description: string;
}

export class DataIndex {
  public id: number;
  public name: string;
  public value: string;
}

export class WalletUser {
  public id: number;
  public address: string;
  public inserted_at: string;
}

export class TechType {
  public id: number;
  public index: string;
  public name: string;
  public description: string;
  public created_at: string;
}

export class TechSigil {
  public id: number;
  public index: string;
  public name: string;
  public description: string;
  public created_at: string;
}

export class TechWisdom {
  public id: number;
  public index: string;
  public name: string;
  public description: string;
  public created_at: string;
}

export class TechLocation {
  public id: number;
  public tokenid: number;
  public index: string;
  public name: string;
  public description: string;
  public image: string;
  public mintedby: number;
  public owner: number;
  public created_at: string;
  public present: TechLocationPresent; //json
}

export class TechLocationDescription {
  public id: number;
  public locationid: number;
  public descindex: number;
  public description: string;
  public active: boolean;
  public previous: number;
  public created_at: string;
}

export class TechCombinationName {
  public id: number;
  public combination: string;
  public name: string;
  public namedby: number;
  public active: boolean;
  public previous: number;
  public created_at: string;
}

export class TechCombinationDescription {
  public id: number;
  public combination: string;
  public description: string;
  public describedby: number;
  public active: boolean;
  public previous: number;
  public created_at: string;
}

export class TechTechnomancer {
  public id?: number;
  public tokenid: number;
  public locationid: number;
  public typeid: number;
  public sigilid: number;
  public wisdomid?: number;
  public name?: string;
  public description?: string;
  public image: string;
  public parentid?: number;
  public mintedby: number;
  public owner: number;
  public created_at?: string;
}

export class TechTechnomancerTransfer {
  public id?: number;
  public technomancerid: number;
  public from?: number;
  public to: number;
  public block: number;
  public blocktimestamp: Date;
  public created_at?: string;
}

export class TechLocationTransfer {
  public id: number;
  public locationid: number;
  public from: number;
  public to: number;
  public block: number;
  public blocktimestamp: Date;
  public created_at: string;
}

export class TechTechnomancerHistory {
  public id?: number;
  public technomancerid: number;
  public name: string;
  public description: string;
  public locationid: number;
  public sigilid: number;
  public wisdomid: number;
  public owner: number;
  public block: number;
  public blocktimestamp: Date;
  public created_at?: string;
}

export class TechLocationHistory {
  public id: number;
  public name: string;
  public description: string;
  public locationid: number;
  public owner: number;
  public block: number;
  public blocktimestamp: Date;
  public created_at: string;
  public present: TechLocationPresent; //json
}

export class TechLocationPresent {
  public ids: number[];
  public block: number;
  public blocktimestamp: Date;
}