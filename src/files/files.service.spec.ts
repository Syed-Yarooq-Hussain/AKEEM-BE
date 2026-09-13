import { NotFoundException } from '@nestjs/common';
import { FilesService } from './files.service';

describe('FilesService security and cleanup', () => {
  const auth = { id: 1, organizationId: 10 };

  it('denies a cross-tenant file lookup without exposing storage details', async () => {
    const service = new FilesService(
      { findOne: jest.fn().mockResolvedValue(null) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await expect(service.file(auth, 99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes knowledge chunks and document rows with the file', async () => {
    const file = {
      id: 5,
      organizationId: 10,
      entityType: null,
      storageKey: 'does-not-exist',
      destroy: jest.fn(),
    };
    const chunks = { destroy: jest.fn().mockResolvedValue(2) };
    const documents = { destroy: jest.fn().mockResolvedValue(1) };
    const service = new FilesService(
      { findOne: jest.fn().mockResolvedValue(file) } as any,
      {} as any,
      {} as any,
      documents as any,
      chunks as any,
      {} as any,
      {} as any,
    );

    await expect(service.remove(auth, 5)).resolves.toMatchObject({
      deleted: true,
      knowledgeEntriesDeleted: true,
    });
    expect(chunks.destroy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fileId: 5, organizationId: 10 } }),
    );
    expect(documents.destroy).toHaveBeenCalled();
    expect(file.destroy).toHaveBeenCalled();
  });
});
