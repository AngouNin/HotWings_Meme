import * as anchor from "@project-serum/anchor"; // Anchor library for Solana development
import { Program } from "@project-serum/anchor";
import { Hotwings } from "../target/types/hotwings"; // Your program's IDL
import { assert, expect } from "chai"; // For assertions
import 'dotenv/config';

describe("HotWings Memecoin Tests", () => {
  // Configure the provider (Solana RPC) for the tests
  const provider = anchor.AnchorProvider.env();

  // Set the provider to use for all web3 interactions
  anchor.setProvider(provider);

  // Get the program (HotWings) to test
  const program = anchor.workspace.Hotwings as Program<Hotwings>;
  // console.log("Anchor Workspace:", anchor.workspace);
  // console.log("Program:", program);
  console.log("Program ID:", program?.programId?.toBase58());


  // Random wallets for testing
  const admin = provider.wallet.publicKey; // The payer/admin wallet for tests
  // const admin = new anchor.web3.PublicKey("AziR2WVaX8rgceQmPTTd7AwS7Z1NaP62XUedarAUXeC6")
  let hotwingsStatePDA: anchor.web3.PublicKey; // PDA for hotwings state account
  let bump: number; // Bump for the PDA

  // Prerequisite variables (for wallets)
  const burnWallet = new anchor.web3.Keypair();
  const marketingWallet = new anchor.web3.Keypair();
  const projectWallet = new anchor.web3.Keypair();
  // const burnWallet = new anchor.web3.PublicKey("B1opJeR2emYp75spauVHkGXfyxkYSW7GZaN9B3XoUeGK");
  // const marketingWallet = new anchor.web3.PublicKey("AziR2WVaX8rgceQmPTTd7AwS7Z1NaP62XUedarAUXeC6");
  // const projectWallet = new anchor.web3.PublicKey("34o4N3JLTxGsqHtFqwpsPDRyimmhbGrUNhhro6xGKhAS");

  // Global test variables
  const totalSupply = new anchor.BN(1_000_000_000); // 1 billion tokens

  before(async () => {
    // Derive the PDA for the program's state account
    [hotwingsStatePDA, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("hotwings_state")], // Seeds (defined in your contract)
      program.programId // ID of the deployed smart contract
    );
    // -----------------------
    // async function verifyWalletExists(publicKey: anchor.web3.PublicKey) {
    //   const accountInfo = await provider.connection.getAccountInfo(publicKey);
    //   if (!accountInfo) {
    //     console.error(`Wallet does not exist: ${publicKey.toBase58()}`);
    //     throw new Error(`Wallet does not exist: ${publicKey.toBase58()}`);
    //   } else {
    //     console.log(`Wallet exists: ${publicKey.toBase58()}`);
    //   }
    // }
    
    // // In your before() block or test code, validate all wallets
    // await verifyWalletExists(marketingWallet);
    // await verifyWalletExists(burnWallet);
    // await verifyWalletExists(projectWallet);
    // -----------------------------
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
        // projectWallet,
        // marketingWallet,
        // burnWallet
      )
      .accounts({
        hotwingsState: hotwingsStatePDA, // The derived PDA for state
        admin, // Admin wallet
        systemProgram: anchor.web3.SystemProgram.programId, // System Program
      })
      .signers([]) // No additional signers (payer is the admin)
      .rpc(); // Executes the remote procedure call
      console.log("--->Program ID Match")
  
    // Fetch the hotwings state after initialization
    const hotwingsState = await program.account.hotwingsState.fetch(hotwingsStatePDA);

    // Validate the state initialization
    assert.ok(hotwingsState.totalSupply.eq(totalSupply)); // Check the total supply
    assert.equal(hotwingsState.projectWallet.toBase58(), projectWallet.publicKey.toBase58()); // Validate project wallet
    assert.equal(hotwingsState.marketingWallet.toBase58(), marketingWallet.publicKey.toBase58()); // Validate marketing wallet
    assert.equal(hotwingsState.burnWallet.toBase58(), burnWallet.publicKey.toBase58()); // Validate burn wallet
    // assert.equal(hotwingsState.projectWallet.toBase58(), projectWallet.toBase58()); // Validate project wallet
    // assert.equal(hotwingsState.marketingWallet.toBase58(), marketingWallet.toBase58()); // Validate marketing wallet
    // assert.equal(hotwingsState.burnWallet.toBase58(), burnWallet.toBase58()); // Validate burn wallet
    console.log("Initializes the Hotwings Program Success===>")
  });

  // it("Locks tokens for an investor", async () => {
    // // Create an investor wallet
    // // const investor = new anchor.web3.Keypair();
    // const investor = anchor.web3.Keypair.generate();
    // console.log("Investor Public Key:", investor.publicKey.toBase58());

    // await provider.connection.requestAirdrop(investor.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    // const balance = await provider.connection.getBalance(investor.publicKey);
    // console.log("Investor Balance:", balance);


    // // Create an account to hold the investor data
    // const investorAccount = anchor.web3.Keypair.generate();
  
    // // Allocate space for Investor and initialize the account
    // await provider.connection.requestAirdrop(investor.publicKey, 1_000_000_000); // 1 SOL for rent
    // const lamports = await provider.connection.getMinimumBalanceForRentExemption(64); // Calculate rent exemption
    // console.log("Exemption ===>", {lamports})
    // const tx = new anchor.web3.Transaction().add(
    //   anchor.web3.SystemProgram.createAccount({
    //     fromPubkey: provider.wallet.publicKey,
    //     newAccountPubkey: investorAccount.publicKey,
    //     space: 64,
    //     lamports,
    //     programId: program.programId,
    //   })
    // );
    // // console.log("TX ===>", {tx})

    // await provider.sendAndConfirm(tx, [investorAccount]);
    // console.log("Where I am ===>")
    
    // // Lock tokens for the investor
    // const lockAmount = new anchor.BN(500_000); // 500,000 tokens

    


    // await program.methods
    //   .lockTokens(lockAmount) // Lock specific amount of tokens
    //   .accounts({
    //     investor: investorAccount.publicKey, // The investor account
    //     hotwingsState: hotwingsStatePDA, // Global state PDA
    //   })
    //   .signers([investor]) // Investor is the signer
    //   .rpc();
    //   console.log("Invester Pass ===>")
  
    // // Fetch the investor account after the lock
    // const investorState = await program.account.investor.fetch(investorAccount.publicKey);
  
    // // Validate the locked tokens
    // assert.ok(investorState.lockedAmount.eq(lockAmount)); // Ensure correct amounts are locked
    // console.log("Second Step Pass ===>")
    
  // });
  it("Locks tokens for an investor", async function () {
    this.timeout(10000); // Increase timeout to handle async tests
  
    // Generate the investor wallet keypair
    const investor = anchor.web3.Keypair.generate();
    console.log("Investor Public Key:", investor.publicKey.toBase58());
  
    // Airdrop some SOL to the investor's wallet
    const airdropSignature = await provider.connection.requestAirdrop(
      investor.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSignature); // Wait for confirmation
  
    // Confirm the balance after airdrop
    const balance = await provider.connection.getBalance(investor.publicKey);
    console.log("Investor Balance after airdrop:", balance);
  
    if (balance === 0) {
      throw new Error("Investor account has insufficient balance!");
    }
  
    // Lock a specific amount of tokens
    const lockAmount = new anchor.BN(1000);
  
    console.log("Locking tokens...");
    await program.methods
      .lockTokens(lockAmount) // Lock token amount
      .accounts({
        investor: investor.publicKey, // Matches `#[account(mut, signer)]`
        hotwingsState: hotwingsStatePDA, // Global state PDA
      })
      .signers([investor]) // Signer for the transaction
      .rpc();
  
    console.log("Tokens locked successfully! ✅");
  });
  
  
});
