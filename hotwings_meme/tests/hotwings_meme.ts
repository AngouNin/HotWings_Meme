import * as anchor from "@project-serum/anchor";  // Import the Anchor framework to interact with Solana
import { Program } from "@project-serum/anchor";  // Import the Program class to interact with the smart contract
import { PublicKey, SystemProgram } from "@solana/web3.js";  // Import necessary Solana components for interacting with the blockchain
import { expect } from "chai";  // Import chai for assertions in the tests
import { HotwingsContract } from "../target/types/hotwings_contract"; // Import the contract type definition from the Anchor workspace

// Describe the test suite for the hotwings_contract program
describe("hotwings_contract", () => {
  // Set up the provider for interacting with the Solana blockchain (using devnet by default)
  const provider = anchor.AnchorProvider.env(); // This connects to the devnet environment (default setup)
  anchor.setProvider(provider);  // Set the provider globally so the program can interact with the blockchain

  // Define the smart contract (program) that we want to interact with
  const program = anchor.workspace.HotwingsContract as Program<HotwingsContract>;

  // Declare the keypairs for accounts that will interact with the contract
  let stateAccount: anchor.web3.Keypair;  // Account where the contract state will be stored
  let owner: anchor.web3.Keypair;  // The owner of the contract, who can initialize and update the contract
  let receiver: anchor.web3.Keypair;  // Account that will receive tokens in the transfer test
  let burnWallet: anchor.web3.Keypair;  // Wallet to receive the "burned" tokens as part of tax distribution
  let marketingWallet: anchor.web3.Keypair;  // Wallet to receive the "marketing" tokens as part of tax distribution

  // `before` hook to initialize the accounts and set up the environment before running tests
  before(async () => {
    // Generate new keypairs for the state, owner, receiver, burn wallet, and marketing wallet
    stateAccount = anchor.web3.Keypair.generate();
    owner = anchor.web3.Keypair.generate();
    receiver = anchor.web3.Keypair.generate();
    burnWallet = anchor.web3.Keypair.generate();
    marketingWallet = anchor.web3.Keypair.generate();

    // Airdrop SOL to the owner's account to pay for transaction fees
    const airdropSignature = await provider.connection.requestAirdrop(
      owner.publicKey,  // Airdrop SOL to the owner's public key
      anchor.web3.LAMPORTS_PER_SOL * 10  // Airdrop 10 SOL (1 SOL = 1 billion lamports)
    );
    // Wait for the transaction to be confirmed
    await provider.connection.confirmTransaction(airdropSignature);
  });

  // Test for initializing the contract
  it("Initializes the contract", async () => {
    const totalSupply = new anchor.BN(1_000_000);  // Set the total supply of tokens to 1,000,000

    // Call the `initialize` method to initialize the contract state
    await program.methods
      .initialize(totalSupply)  // Pass the total supply to the `initialize` function
      .accounts({
        state: stateAccount.publicKey,  // Specify the state account where contract data will be stored
        owner: owner.publicKey,  // The owner account that is initializing the contract
        systemProgram: SystemProgram.programId,  // The system program needed for account creation
      })
      .signers([stateAccount, owner])  // Sign the transaction with both the `stateAccount` and `owner` accounts
      .rpc();  // Send the transaction to the blockchain

    // Fetch the state account data from the blockchain to verify the initialization
    const state = await program.account.state.fetch(stateAccount.publicKey);

    // Assertions to check if the contract's state was set correctly
    expect(state.owner.toBase58()).to.equal(owner.publicKey.toBase58());  // Verify the owner is correctly set
    expect(state.totalSupply.toNumber()).to.equal(totalSupply.toNumber());  // Verify the total supply matches
    expect(state.marketCap.toNumber()).to.equal(0);  // Verify the initial market cap is set to 0
  });

  // Test for updating the market cap
  it("Updates market cap", async () => {
    const newMarketCap = new anchor.BN(500_000);  // Set a new market cap value

    // Call the `updateMarketCap` method to update the market cap in the contract
    await program.methods
      .updateMarketCap(newMarketCap)  // Pass the new market cap value to the method
      .accounts({
        state: stateAccount.publicKey,  // The state account where the market cap is stored
        owner: owner.publicKey,  // The owner account who is allowed to update the market cap
      })
      .signers([owner])  // Sign the transaction with the `owner` account
      .rpc();  // Send the transaction to the blockchain

    // Fetch the state account data to verify the market cap update
    const state = await program.account.state.fetch(stateAccount.publicKey);
    expect(state.marketCap.toNumber()).to.equal(newMarketCap.toNumber());  // Verify the new market cap
  });

  // Test for performing a token transfer with tax and wallet restrictions
  it("Performs a token transfer with tax and wallet restrictions", async () => {
    const transferAmount = new anchor.BN(10_000);  // Set the amount of tokens to transfer

    // Call the `transfer` method to simulate a token transfer from `owner` to `receiver`
    await program.methods
      .transfer(transferAmount)  // Pass the transfer amount to the `transfer` method
      .accounts({
        state: stateAccount.publicKey,  // The state account that holds contract data
        sender: owner.publicKey,  // The sender (owner) of the tokens
        receiver: receiver.publicKey,  // The receiver of the tokens
        burnWallet: burnWallet.publicKey,  // The wallet where burned tokens will be sent
        marketingWallet: marketingWallet.publicKey,  // The wallet where marketing tokens will be sent
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,  // The SPL Token program needed for token transfers
      })
      .signers([owner])  // Sign the transaction with the `owner` account
      .rpc();  // Send the transaction to the blockchain

    // Fetch the token account for the receiver and verify the balance after the transfer
    const receiverTokenAccount = await program.account.tokenAccount.fetch(receiver.publicKey);
    const tax = Math.floor(transferAmount.toNumber() * 0.015);  // Calculate 1.5% tax on the transfer
    const expectedBalance = transferAmount.toNumber() - tax;  // Calculate the expected balance after tax is deducted
    expect(receiverTokenAccount.amount.toNumber()).to.equal(expectedBalance);  // Verify the receiver's token balance

    // Fetch the burn and marketing wallet token accounts and verify the tax split
    const burnWalletTokenAccount = await program.account.tokenAccount.fetch(burnWallet.publicKey);
    const marketingWalletTokenAccount = await program.account.tokenAccount.fetch(marketingWallet.publicKey);
    const expectedTaxSplit = Math.floor(tax / 2);  // Split the tax equally between burn and marketing wallets

    // Assert that the burn and marketing wallets received the correct amounts
    expect(burnWalletTokenAccount.amount.toNumber()).to.equal(expectedTaxSplit);  // Verify burn wallet balance
    expect(marketingWalletTokenAccount.amount.toNumber()).to.equal(expectedTaxSplit);  // Verify marketing wallet balance
  });
});
