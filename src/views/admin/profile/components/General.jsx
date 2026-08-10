import Card from "components/card";
import React from "react";
import { useAuth } from "contexts/AuthContext";

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

const General = () => {
  const { user, profile } = useAuth();

  return (
    <Card extra={"w-full h-full p-3"}>
      {/* Header */}
      <div className="mt-2 mb-8 w-full">
        <h4 className="px-2 text-xl font-bold text-navy-700 dark:text-white">
          General Information
        </h4>
        <p className="mt-2 px-2 text-base text-gray-600">
          Your Nova Analytics account details. Role, team and plan are read
          from your workspace profile.
        </p>
      </div>
      {/* Cards */}
      <div className="grid grid-cols-2 gap-4 px-2">
        <div className="flex flex-col items-start justify-center rounded-2xl bg-white bg-clip-border px-3 py-4 shadow-3xl shadow-shadow-500 dark:!bg-navy-700 dark:shadow-none">
          <p className="text-sm text-gray-600">Role</p>
          <p className="text-base font-medium capitalize text-navy-700 dark:text-white">
            {profile?.role ?? "Member"}
          </p>
        </div>

        <div className="flex flex-col justify-center rounded-2xl bg-white bg-clip-border px-3 py-4 shadow-3xl shadow-shadow-500 dark:!bg-navy-700 dark:shadow-none">
          <p className="text-sm text-gray-600">Plan</p>
          <p className="text-base font-medium text-navy-700 dark:text-white">
            Nova Scale
          </p>
        </div>

        <div className="flex flex-col items-start justify-center rounded-2xl bg-white bg-clip-border px-3 py-4 shadow-3xl shadow-shadow-500 dark:!bg-navy-700 dark:shadow-none">
          <p className="text-sm text-gray-600">Team</p>
          <p className="text-base font-medium text-navy-700 dark:text-white">
            {profile?.team ?? "Unassigned"}
          </p>
        </div>

        <div className="flex flex-col justify-center rounded-2xl bg-white bg-clip-border px-3 py-4 shadow-3xl shadow-shadow-500 dark:!bg-navy-700 dark:shadow-none">
          <p className="text-sm text-gray-600">Data residency</p>
          <p className="text-base font-medium text-navy-700 dark:text-white">
            EU (Frankfurt)
          </p>
        </div>

        <div className="flex flex-col items-start justify-center rounded-2xl bg-white bg-clip-border px-3 py-4 shadow-3xl shadow-shadow-500 dark:!bg-navy-700 dark:shadow-none">
          <p className="text-sm text-gray-600">Organization</p>
          <p className="text-base font-medium text-navy-700 dark:text-white">
            Nova Analytics
          </p>
        </div>

        <div className="flex flex-col justify-center rounded-2xl bg-white bg-clip-border px-3 py-4 shadow-3xl shadow-shadow-500 dark:!bg-navy-700 dark:shadow-none">
          <p className="text-sm text-gray-600">Member since</p>
          <p className="text-base font-medium text-navy-700 dark:text-white">
            {formatDate(profile?.created_at ?? user?.created_at)}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default General;
