using System;
using System.Collections.Generic;
using Raven.Abstractions.Data;

namespace Raven.Database.Indexing
{
	public class IndexingBatch
	{
		public IndexingBatch(Etag highestEtagBeforeFiltering)
		{
			HighestEtagBeforeFiltering = highestEtagBeforeFiltering;
			Ids = new List<string>();
			Docs = new List<dynamic>();
			SkipDeleteFromIndex = new List<bool>();
		}

		public readonly List<string> Ids;
		public readonly List<dynamic> Docs;
		public readonly List<bool> SkipDeleteFromIndex;
		public DateTime? DateTime;
		public readonly Etag HighestEtagBeforeFiltering;
		public IndexingPerformanceStats IndexingPerformance;

		public void Add(JsonDocument doc, object asJson, bool skipDeleteFromIndex)
		{
			Ids.Add(doc.Key);
			Docs.Add(asJson);
            SkipDeleteFromIndex.Add(skipDeleteFromIndex);
		}
	}
}