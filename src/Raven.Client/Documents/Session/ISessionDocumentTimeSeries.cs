//-----------------------------------------------------------------------
// <copyright file="ISessionDocumentTimeSeries.cs" company="Hibernating Rhinos LTD">
//     Copyright (c) Hibernating Rhinos LTD. All rights reserved.
// </copyright>
//-----------------------------------------------------------------------

using System;
using System.Collections.Generic;
using Raven.Client.Documents.Session.TimeSeries;

namespace Raven.Client.Documents.Session
{
    /// <summary>
    ///     Time series synchronous session operations
    /// </summary>
    public interface ISessionDocumentTimeSeries : ISessionDocumentTimeSeriesBase
    {
        /// <summary>
        /// Return the time series values for the provided range
        /// </summary>
        IEnumerable<TimeSeriesEntry> Get(string timeseries, DateTime from, DateTime to);

    }
}
