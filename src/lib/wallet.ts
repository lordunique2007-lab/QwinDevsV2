import { prisma } from "@/lib/prisma";
import { TxType } from "@prisma/client";

export class WalletError extends Error {}

/**
 * Moves Qwin Currency from one user's wallet to another inside a single
 * database transaction. Uses a conditional update (balance >= amount) so
 * concurrent requests can never push a wallet negative, and the whole
 * operation either fully commits or fully rolls back — no partial transfers.
 */
export async function transferQC(params: {
  senderUserId: string;
  receiverUsername: string;
  amount: number;
  type: TxType;
  description?: string;
}) {
  const { senderUserId, receiverUsername, amount, type, description } = params;

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new WalletError("Amount must be a positive whole number of QC.");
  }

  return prisma.$transaction(async (tx) => {
    const sender = await tx.wallet.findUnique({ where: { userId: senderUserId } });
    if (!sender) throw new WalletError("Sender wallet not found.");

    const receiver = await tx.user.findUnique({
      where: { username: receiverUsername.toLowerCase() },
      include: { wallet: true }
    });
    if (!receiver || !receiver.wallet) throw new WalletError("Recipient not found.");

    if (receiver.id === senderUserId) {
      throw new WalletError("You cannot send Qwin Currency to yourself.");
    }

    // Conditional decrement: only succeeds if balance is still sufficient.
    // This is what makes the operation safe under concurrent requests.
    const debited = await tx.wallet.updateMany({
      where: { id: sender.id, balance: { gte: amount } },
      data: {
        balance: { decrement: amount },
        lifetimeOut: { increment: amount }
      }
    });

    if (debited.count === 0) {
      throw new WalletError("Insufficient Qwin Currency balance.");
    }

    await tx.wallet.update({
      where: { id: receiver.wallet.id },
      data: {
        balance: { increment: amount },
        lifetimeIn: { increment: amount }
      }
    });

    const transaction = await tx.transaction.create({
      data: {
        senderId: sender.id,
        receiverId: receiver.wallet.id,
        amount,
        type,
        status: "COMPLETED",
        description: description ?? ""
      }
    });

    return transaction;
  });
}

/** Credits a wallet with no corresponding sender (rewards, refunds, admin grants). */
export async function creditQC(params: {
  receiverUserId: string;
  amount: number;
  type: TxType;
  description?: string;
}) {
  const { receiverUserId, amount, type, description } = params;

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new WalletError("Amount must be a positive whole number of QC.");
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId: receiverUserId } });
    if (!wallet) throw new WalletError("Wallet not found.");

    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: amount },
        lifetimeIn: { increment: amount }
      }
    });

    return tx.transaction.create({
      data: {
        senderId: null,
        receiverId: wallet.id,
        amount,
        type,
        status: "COMPLETED",
        description: description ?? ""
      }
    });
  });
}

/**
 * Debits a wallet with no receiving user — used for platform purchases
 * (Premium subscriptions, project/bot/community boosts) where the QC is
 * spent into the platform rather than sent to another person. Uses the
 * same conditional-decrement pattern as transferQC so it can never push
 * a balance negative under concurrent requests.
 */
export async function debitQC(params: {
  userId: string;
  amount: number;
  type: TxType;
  description?: string;
}) {
  const { userId, amount, type, description } = params;

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new WalletError("Amount must be a positive whole number of QC.");
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new WalletError("Wallet not found.");

    const debited = await tx.wallet.updateMany({
      where: { id: wallet.id, balance: { gte: amount } },
      data: {
        balance: { decrement: amount },
        lifetimeOut: { increment: amount }
      }
    });

    if (debited.count === 0) {
      throw new WalletError("Insufficient Qwin Currency balance.");
    }

    return tx.transaction.create({
      data: {
        senderId: wallet.id,
        receiverId: wallet.id, // Platform purchases record the spender as both ends — there's no counterparty wallet.
        amount,
        type,
        status: "COMPLETED",
        description: description ?? ""
      }
    });
  });
}

export async function getWalletWithHistory(userId: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    include: {
      sent: { orderBy: { createdAt: "desc" }, take: 50, include: { receiver: { include: { user: true } } } },
      received: { orderBy: { createdAt: "desc" }, take: 50, include: { sender: { include: { user: true } } } }
    }
  });
  return wallet;
}
