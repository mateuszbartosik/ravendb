//-----------------------------------------------------------------------
// <copyright file="IAsyncSessionDocumentTimeSeries.cs" company="Hibernating Rhinos LTD">
//     Copyright (c) Hibernating Rhinos LTD. All rights reserved.
// </copyright>
//-----------------------------------------------------------------------

using System.Collections.Generic;
using System.Threading;
using System;
using System.Threading.Tasks;
using Raven.Client.Documents.Session.TimeSeries;

namespace Raven.Client.Documents.Session
{
    /// <summary>
    ///     Advanced async TimeSeries session operations
    /// </summary>
    public interface IAsyncSessionDocumentTimeSeries : ISessionDocumentTimeSeriesBase
    {
        Task<IEnumerable<TimeSeriesEntry>> GetAsync(string timeseries, DateTime from, DateTime to, CancellationToken token = default);

    }
}
