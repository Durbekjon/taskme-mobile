import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Add, Wallet, TrendUp, CloseCircle, Trash } from 'iconsax-react-native';
import { useAuth } from '../../context/AuthContext';
import { financeApi } from '../../libs/endpoints';
import { money } from '../../libs/format';
import type { Expense, StudioFinanceSummary } from '../../types/api';

const EXPENSE_CATEGORIES = ['Equipment Rental', 'Travel', 'Accommodation', 'Marketing', 'Other'];

function StatCard({
  label,
  value,
  sub,
  dark,
}: {
  label: string;
  value: string;
  sub?: string;
  dark?: boolean;
}) {
  return (
    <View
      className={`rounded-3xl p-5 border ${
        dark ? 'bg-black border-transparent' : 'bg-gray-50 border-gray-100'
      }`}
    >
      <Text className={`text-xs font-semibold uppercase tracking-wider mb-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
        {label}
      </Text>
      <Text className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{value}</Text>
      {sub ? (
        <Text className={`text-xs mt-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{sub}</Text>
      ) : null}
    </View>
  );
}

export default function FinanceScreen() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<StudioFinanceSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);

  // Expense modal
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Equipment Rental');
  const [description, setDescription] = useState('');

  const loadData = useCallback(async () => {
    if (!user?.studioId) return;
    try {
      setLoading(true);
      const [sum, exps] = await Promise.all([
        financeApi.studioSummary(),
        financeApi.studioExpenses(),
      ]);
      setSummary(sum);
      setExpenses(exps);
    } catch (err) {
      console.error('Failed to load finance data', err);
    } finally {
      setLoading(false);
    }
  }, [user?.studioId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAddExpense = async () => {
    if (!amount || !description) return;
    try {
      setIsSubmitting(true);
      await financeApi.addExpense({
        amount: Number(amount),
        category,
        description,
      });
      await loadData();
      setModalOpen(false);
      setAmount('');
      setDescription('');
      setCategory('Equipment Rental');
    } catch {
      Alert.alert('Error', 'Failed to add expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Expense', 'Are you sure you want to delete this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await financeApi.deleteExpense(id);
            await loadData();
          } catch {
            Alert.alert('Error', 'Failed to delete expense');
          }
        },
      },
    ]);
  };

  const profitMargin =
    summary && summary.revenue > 0
      ? Math.round((summary.studioProfit / summary.revenue) * 100)
      : 0;

  const safeExpenses = Array.isArray(expenses) ? expenses : [];

  return (
    <>
      <ScrollView
        className="flex-1 bg-white"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
      >
        <View className="px-6 pt-16 pb-6">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-gray-900">Finance</Text>
            <TouchableOpacity
              onPress={() => setModalOpen(true)}
              className="flex-row items-center gap-1.5 bg-black px-3 py-2 rounded-xl"
            >
              <Add size={16} color="#FFFFFF" />
              <Text className="text-white text-xs font-semibold">Add Expense</Text>
            </TouchableOpacity>
          </View>

          {/* KPI Grid */}
          <View className="flex-row gap-3 mb-3">
            <View className="flex-1">
              <StatCard
                label="Total Revenue"
                value={money(summary?.revenue)}
                sub={`Received: ${money(summary?.clientPaymentsReceived)}`}
              />
            </View>
            <View className="flex-1">
              <StatCard
                label="Client Balance"
                value={money(summary?.clientBalance)}
                sub="Outstanding"
              />
            </View>
          </View>

          <View className="flex-row gap-3 mb-3">
            <View className="flex-1">
              <StatCard
                label="Crew Costs"
                value={money(summary?.workerCosts)}
                sub={`Still owed: ${money(summary?.workerBalance)}`}
              />
            </View>
            <View className="flex-1">
              <StatCard
                label="Other Expenses"
                value={money(summary?.otherExpenses)}
              />
            </View>
          </View>

          <StatCard
            label="Net Profit"
            value={money(summary?.studioProfit)}
            sub="After all expenses"
            dark
          />

          {/* Profit Margin Bar */}
          {summary && (
            <View className="bg-gray-50 border border-gray-100 rounded-3xl p-5 mt-3 mb-6">
              <Text className="text-sm font-bold text-gray-900 mb-4">Profit Margin</Text>
              <View className="mb-3">
                <View className="flex-row justify-between mb-1.5">
                  <Text className="text-xs text-gray-500">Target</Text>
                  <Text className="text-xs font-semibold text-gray-700">50%</Text>
                </View>
                <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <View className="h-full bg-gray-400 rounded-full" style={{ width: '50%' }} />
                </View>
              </View>
              <View>
                <View className="flex-row justify-between mb-1.5">
                  <Text className="text-xs text-gray-500">Current</Text>
                  <Text
                    className={`text-xs font-semibold ${profitMargin >= 40 ? 'text-emerald-600' : 'text-amber-600'}`}
                  >
                    {profitMargin}%
                  </Text>
                </View>
                <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <View
                    className={`h-full rounded-full ${profitMargin >= 40 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(100, Math.max(0, profitMargin))}%` }}
                  />
                </View>
                <Text
                  className={`text-xs font-semibold mt-2 ${profitMargin >= 40 ? 'text-emerald-600' : 'text-amber-600'}`}
                >
                  {profitMargin >= 40 ? 'Healthy' : 'At risk'}
                </Text>
              </View>
            </View>
          )}

          {/* Expenses list */}
          <Text className="text-lg font-bold text-gray-900 mb-4">Recent Expenses</Text>
          {safeExpenses.length === 0 ? (
            <View className="bg-gray-50 p-8 rounded-3xl items-center border border-gray-100">
              <Text className="font-bold text-gray-900">No expenses recorded yet</Text>
            </View>
          ) : (
            safeExpenses.map((e) => (
              <View
                key={e.id}
                className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-3 flex-row justify-between items-center"
              >
                <View className="flex-1 pr-3">
                  <View className="flex-row items-center gap-2 mb-1">
                    <View className="bg-gray-200 px-2 py-0.5 rounded-md">
                      <Text className="text-xs font-semibold text-gray-700">{e.category}</Text>
                    </View>
                  </View>
                  <Text className="font-bold text-gray-900">{money(e.amount)}</Text>
                  {e.description ? (
                    <Text className="text-xs text-gray-500 mt-0.5">{e.description}</Text>
                  ) : null}
                  {e.expenseDate ? (
                    <Text className="text-xs text-gray-400 mt-0.5">
                      {new Date(e.expenseDate).toLocaleDateString()}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(e.id)}
                  className="p-2 rounded-lg bg-red-50"
                >
                  <Trash size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Expense Modal */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1 bg-white">
            <View className="flex-row justify-between items-center px-6 py-5 border-b border-gray-100">
              <Text className="text-lg font-bold text-gray-900">New Expense</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <CloseCircle size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                Category
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                {EXPENSE_CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCategory(c)}
                    className={`mr-2 px-4 py-2 rounded-xl border ${
                      category === c ? 'bg-black border-black' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <Text className={`text-sm font-medium ${category === c ? 'text-white' : 'text-gray-700'}`}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                Amount ($) *
              </Text>
              <View className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4">
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  className="text-gray-900"
                />
              </View>

              <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                Description *
              </Text>
              <View className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6">
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="e.g. Camera lens rental"
                  placeholderTextColor="#9CA3AF"
                  className="text-gray-900"
                />
              </View>

              <TouchableOpacity
                onPress={handleAddExpense}
                disabled={isSubmitting || !amount || !description}
                className={`py-4 rounded-2xl items-center flex-row justify-center gap-2 ${
                  isSubmitting || !amount || !description ? 'bg-gray-200' : 'bg-black'
                }`}
              >
                {isSubmitting && <ActivityIndicator size="small" color="#FFFFFF" />}
                <Text
                  className={`font-bold ${
                    isSubmitting || !amount || !description ? 'text-gray-500' : 'text-white'
                  }`}
                >
                  Add Expense
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
