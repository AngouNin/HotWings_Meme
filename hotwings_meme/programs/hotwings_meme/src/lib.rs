use anchor_lang::prelude::*;

declare_id!("F315xx75TiyxnGV4vAZssphVdauiYNA5bJThvKGty6Mj");

#[program]
pub mod hotwings_meme {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
