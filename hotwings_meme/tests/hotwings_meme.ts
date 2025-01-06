import * as anchor from "@project-serum/anchor"; // Anchor library for Solana development
import { Program } from "@project-serum/anchor";
import { Hotwings } from "../target/types/hotwings"; // Your program's IDL
import { assert, expect } from "chai"; // For assertions

describe("HotWings Memecoin Tests", () => {
  // Configure the provider (Solana RPC) for the tests
  const provider = anchor.AnchorProvider.env();

  // Set the provider to use for all web3 interactions
  anchor.setProvider(provider);

  // Get the program (HotWings) to test
  const program = anchor.workspace.Hotwings as Program<Hotwings>;

  // Random wallets for testing
  const admin = provider.wallet.publicKey; // The payer/admin wallet for tests
  let hotwingsStatePDA: anchor.web3.PublicKey; // PDA for hotwings state account
  let bump: number; // Bump for the PDA

  // Prerequisite variables (for wallets)
  const burnWallet = new anchor.web3.Keypair();
  const marketingWallet = new anchor.web3.Keypair();
  const projectWallet = new anchor.web3.Keypair();

  // Global test variables
  const totalSupply = new anchor.BN(1_000_000_000); // 1 billion tokens

  before(async () => {
    // Derive the PDA for the program's state account
    [hotwingsStatePDA, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("hotwings_state")], // Seeds (defined in your contract)
      program.programId // ID of the deployed smart contract
    );
  });

  it("Initializes the HotWings Program", async () => {
    // Initialize the hotwings program
    await program.methods
      .initialize(
        totalSupply, // Total supply of HotWings tokens
        anchor.web3.Keypair.generate().publicKey, // Mock market_cap_oracle
        projectWallet.publicKey, // Project wallet
        marketingWallet.publicKey, // Marketing wallet
        burnWallet.publicKey // Burn wallet
      )
      .accounts({
        hotwingsState: hotwingsStatePDA, // The derived PDA for state
        admin, // Admin wallet
        systemProgram: anchor.web3.SystemProgram.programId, // System Program
      })
      .signers([]) // No additional signers (payer is the admin)
      .rpc(); // Executes the remote procedure call
  
    // Fetch the hotwings state after initialization
    const hotwingsState = await program.account.hotwingsState.fetch(hotwingsStatePDA);

    // Validate the state initialization
    assert.ok(hotwingsState.totalSupply.eq(totalSupply)); // Check the total supply
    assert.equal(hotwingsState.projectWallet.toBase58(), projectWallet.publicKey.toBase58()); // Validate project wallet
    assert.equal(hotwingsState.marketingWallet.toBase58(), marketingWallet.publicKey.toBase58()); // Validate marketing wallet
    assert.equal(hotwingsState.burnWallet.toBase58(), burnWallet.publicKey.toBase58()); // Validate burn wallet
  });
});
