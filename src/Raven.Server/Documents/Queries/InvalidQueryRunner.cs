﻿using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Raven.Client.Documents.Operations;
using Raven.Client.Documents.Queries;
using Raven.Server.ServerWide;
using Raven.Server.ServerWide.Context;
using Sparrow.Json;
using PatchRequest = Raven.Server.Documents.Patch.PatchRequest;

namespace Raven.Server.Documents.Queries
{
    public class InvalidQueryRunner : AbstractQueryRunner
    {
        public InvalidQueryRunner(DocumentDatabase database) : base(database)
        {
        }

        public override Task<DocumentQueryResult> ExecuteQuery(IndexQueryServerSide query, DocumentsOperationContext documentsContext, long? existingResultEtag, OperationCancelToken token)
        {
            throw new NotSupportedException("Dynamic queries are not supported by this database because the configuration 'Indexing.DisableQueryOptimizerGeneratedIndexes' is set to ture and the query optimizer needs an index for this query");
        }

        public override Task ExecuteStreamQuery(IndexQueryServerSide query, DocumentsOperationContext documentsContext, HttpResponse response, IStreamDocumentQueryResultWriter writer,
            OperationCancelToken token)
        {
            throw new NotSupportedException("Dynamic queries are not supported by this database because the configuration 'Indexing.DisableQueryOptimizerGeneratedIndexes' is set to ture and the query optimizer needs an index for this query");
        }

        public override Task<IndexEntriesQueryResult> ExecuteIndexEntriesQuery(IndexQueryServerSide query, DocumentsOperationContext context, long? existingResultEtag, OperationCancelToken token)
        {
            throw new NotSupportedException("Dynamic queries are not supported by this database because the configuration 'Indexing.DisableQueryOptimizerGeneratedIndexes' is set to ture and the query optimizer needs an index for this query");
        }

        public override Task<IOperationResult> ExecuteDeleteQuery(IndexQueryServerSide query, QueryOperationOptions options, DocumentsOperationContext context, Action<IOperationProgress> onProgress, OperationCancelToken token)
        {
            throw new NotSupportedException("Dynamic queries are not supported by this database because the configuration 'Indexing.DisableQueryOptimizerGeneratedIndexes' is set to ture and the query optimizer needs an index for this query");
        }

        public override Task<IOperationResult> ExecutePatchQuery(IndexQueryServerSide query, QueryOperationOptions options, PatchRequest patch, BlittableJsonReaderObject patchArgs,
            DocumentsOperationContext context, Action<IOperationProgress> onProgress, OperationCancelToken token)
        {
            throw new NotSupportedException("Dynamic queries are not supported by this database because the configuration 'Indexing.DisableQueryOptimizerGeneratedIndexes' is set to ture and the query optimizer needs an index for this query");
        }
    }
}
