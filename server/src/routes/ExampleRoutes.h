/**
 * @file            ExampleRoutes.h
 *
 * @date            2026-11-8
 *
 * @version         1.0.0
 *
 * @copyright       Copyright (c) 2026 privateMwb
 *                  All rights reserved.
 *                  https://github.com/privateMwb/FalconEye
 *
 * @attention       This source is released under the MIT license
 *                  SPDX-License-Identifier: MIT
 *                  <http://opensource.org/licenses/MIT>
 */

#pragma once

// clang-format off
#include <FalconHTTP/HTTP/HttpStatus.h> // HttpStatus
#include <FalconHTTP/Routing/Router.h>  // Router

#include <MiniDB/Core/Database.h>       // Database
#include <MiniDB/Core/Record.h>         // Record
#include <MiniDB/Engine/QueryEngine.h>  // QueryEngine

#include "DbTiming.h"                   // timedCall()

#include <string>                       // std::string, std::stoul
// clang-format on

/**
 * @brief Registers placeholder routes for testing `Metrics` + MiniDB
 * timing end to end. Not the real application routes -- swap these for
 * actual handlers once available.
 * @param router Router to register routes on.
 * @param db MiniDB database FalconEye reads from. Must outlive the
 * server.
 * @param queryEngine Query engine used for the DB-backed route. Must
 * outlive the server.
 */
inline void registerExampleRoutes(FalconHTTP::Routing::Router& router, MiniDB::Core::Database& db,
                                  MiniDB::Engine::QueryEngine& queryEngine) {
    // Fast route: no DB call, should show up with a low totalMs and an
    // empty breakdown.
    router.get("/api/health",
               [](const FalconHTTP::HTTP::HttpRequest&, FalconHTTP::HTTP::HttpResponse& response) {
                   response.setStatus(FalconHTTP::HTTP::HttpStatus::Ok);
                   response.setBody(R"({"status":"ok"})");
               });

    // DB-backed route: looks up a record via MiniDB, wrapped in
    // timedCall() so its duration lands in this request's breakdown
    // under "dbQuery" -- see Metrics.h / DbTiming.h.
    router.get("/api/todos/:id", [&db, &queryEngine](const FalconHTTP::HTTP::HttpRequest& request,
                                                     FalconHTTP::HTTP::HttpResponse& response) {
        std::string idStr = request.pathParam("id");
        MiniDB::Common::RecordID id = static_cast<MiniDB::Common::RecordID>(std::stoul(idStr));

        MiniDB::Core::Table* table = db.getTable("todos");
        if (table == nullptr) {
            response.setStatus(FalconHTTP::HTTP::HttpStatus::NotFound);
            response.setBody(R"({"error":"table not found"})");
            return;
        }

        MiniDB::Engine::QueryResult result =
            timedCall("dbQuery", [&]() { return queryEngine.selectByID(*table, id); });

        if (result.status != MiniDB::Common::Status::OK || result.records.empty()) {
            response.setStatus(FalconHTTP::HTTP::HttpStatus::NotFound);
            response.setBody(R"({"error":"not found"})");
            return;
        }

        response.setStatus(FalconHTTP::HTTP::HttpStatus::Ok);
        response.setJson(result.records[0].toJson());
    });
}
