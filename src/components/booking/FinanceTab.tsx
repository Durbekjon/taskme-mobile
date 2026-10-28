import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity,
  Alert, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Add, DollarCircle, Receipt2, MoneySend, CloseCircle } from 'iconsax-react-native';
import { financeApi } from '../../libs/endpoints';
import type {
  Booking, ClientPayment, WorkerPayment, Expense, CrewAssignment,
} from '../../types/api';
import { ClientPaymentType } from '../../types/api';
import { money, localDate } from '../../libs/format';

const PAYMENT_TYPES = Object.values(ClientPaymentType);
const EXPENSE_CATEGORIES = ['Equipment Rental', 'Travel', 'Accommodation', 'Marketing', 'Other'];

function SectionHeader({
  title,
  onAdd,
}: {
  title: string;
  onAdd: () => void;
}) {
  return (
    <View className="flex-row justify-between items-center mb-3">
      <Text className="text-lg font-bold text-gray-900">{title}</Text>
      <TouchableOpacity
        onPress={onAdd}
        className="bg-black w-8 h-8 rounded-full items-center justify-center"
      >
        <Add size={16} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

export function FinanceTab({ booking }: { booking: Booking }) {
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>([]);
  const [workerPayments, setWorkerPayments] = useState<WorkerPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [assignments, setAssignments] = useState<CrewAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Client payment modal
  const [showClientModal, setShowClientModal] = useState(false);
  const [cpAmount, setCpAmount] = useState('');
  const [cpType, setCpType] = useState<ClientPaymentType>(ClientPaymentType.DEPOSIT);

  // Worker payment modal
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [wpAssignmentId, setWpAssignmentId] = useState('');
  const [wpAmount, setWpAmount] = useState('');

  // Expense modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expCategory, setExpCategory] = useState('Equipment Rental');
  const [expAmount, setExpAmount] = useState('');
  const [expDescription, setExpDescription] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [cp, wp, exp, crew] = await Promise.all([
        financeApi.clientPayments(booking.id),
        financeApi.workerPayments(booking.id),
        financeApi.expenses(booking.id),
        import('../../libs/endpoints').then((m) =>
          m.crewApi.listByBooking(booking.id),
        ),
      ]);
      setClientPayments(cp);
      setWorkerPayments(wp);
      setExpenses(exp);
      setAssignments(crew);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [booking.id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // --- Submit handlers ---

  const handleAddClientPayment = async () => {
    if (!cpAmount) return;
    try {
      setIsSubmitting(true);
      const created = await financeApi.addClientPayment({
        bookingId: booking.id,
        amount: Number(cpAmount),
        paymentType: cpType,
      });
      setClientPayments((prev) => [...prev, created]);
      setShowClientModal(false);
      setCpAmount('');
      setCpType(ClientPaymentType.DEPOSIT);
    } catch {
      Alert.alert('Error', 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddWorkerPayment = async () => {
    if (!wpAssignmentId || !wpAmount) return;
    try {
      setIsSubmitting(true);
      const created = await financeApi.addWorkerPayment({
        assignmentId: wpAssignmentId,
        amount: Number(wpAmount),
      });
      setWorkerPayments((prev) => [...prev, created]);
      setShowWorkerModal(false);
      setWpAssignmentId('');
      setWpAmount('');
    } catch {
      Alert.alert('Error', 'Failed to record payout');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddExpense = async () => {
    if (!expAmount || !expDescription) return;
    try {
      setIsSubmitting(true);
      const created = await financeApi.addExpense({
        bookingId: booking.id,
        category: expCategory,
        description: expDescription,
        amount: Number(expAmount),
      });
      setExpenses((prev) => [...prev, created]);
      setShowExpenseModal(false);
      setExpAmount('');
      setExpDescription('');
      setExpCategory('Equipment Rental');
    } catch {
      Alert.alert('Error', 'Failed to add expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center py-10">
        <ActivityIndicator size="small" />
      </View>
    );
  }

  const totalPaid = clientPayments.reduce((s, p) => s + p.amount, 0);
  const totalCosts =
    expenses.reduce((s, e) => s + e.amount, 0) +
    workerPayments.reduce((s, p) => s + p.amount, 0);
  const profit = totalPaid - totalCosts;

  return (
    <>
      <ScrollView keyboardDismissMode="on-drag" className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Summary */}
        <View className="bg-black p-5 rounded-2xl mb-5">
          <Text className="text-gray-400 text-xs uppercase tracking-wider mb-1">Agreed Price</Text>
          <Text className="text-3xl font-bold text-white mb-4">{money(booking.agreedPrice)}</Text>
          <View className="flex-row justify-between border-t border-gray-800 pt-4">
            <View>
              <Text className="text-gray-400 text-xs uppercase mb-1">Paid by Client</Text>
              <Text className="text-white font-semibold">{money(totalPaid)}</Text>
            </View>
            <View>
              <Text className="text-gray-400 text-xs uppercase mb-1">Total Costs</Text>
              <Text className="text-white font-semibold">{money(totalCosts)}</Text>
            </View>
            <View>
              <Text className="text-gray-400 text-xs uppercase mb-1">Gross Profit</Text>
              <Text className={`font-semibold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {money(profit)}
              </Text>
            </View>
          </View>
        </View>

        {/* Client Payments */}
        <SectionHeader title="Client Payments" onAdd={() => setShowClientModal(true)} />
        {clientPayments.length === 0 ? (
          <Text className="text-gray-400 text-sm mb-5">No payments recorded.</Text>
        ) : (
          clientPayments.map((p) => (
            <View
              key={p.id}
              className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-3 flex-row justify-between items-center"
            >
              <View>
                <Text className="font-bold text-gray-900">{money(p.amount)}</Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  {p.paymentType} · {localDate(p.paymentDate) ?? '—'}
                </Text>
              </View>
              {p.notes ? (
                <Text className="text-xs text-gray-400 flex-shrink pl-4" numberOfLines={2}>
                  {p.notes}
                </Text>
              ) : null}
            </View>
          ))
        )}

        {/* Expenses */}
        <View className="mt-2">
          <SectionHeader title="Expenses" onAdd={() => setShowExpenseModal(true)} />
        </View>
        {expenses.length === 0 ? (
          <Text className="text-gray-400 text-sm mb-5">No expenses recorded.</Text>
        ) : (
          expenses.map((e) => (
            <View
              key={e.id}
              className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-3 flex-row justify-between items-center"
            >
              <View className="flex-1">
                <Text className="font-bold text-gray-900">{money(e.amount)}</Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  {e.category} · {localDate(e.expenseDate) ?? '—'}
                </Text>
                {e.description ? (
                  <Text className="text-xs text-gray-400 mt-0.5">{e.description}</Text>
                ) : null}
              </View>
            </View>
          ))
        )}

        {/* Worker Payouts */}
        <View className="mt-2">
          <SectionHeader title="Worker Payouts" onAdd={() => setShowWorkerModal(true)} />
        </View>
        {workerPayments.length === 0 ? (
          <Text className="text-gray-400 text-sm mb-5">No payouts recorded.</Text>
        ) : (
          workerPayments.map((p) => (
            <View
              key={p.id}
              className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-3 flex-row justify-between items-center"
            >
              <View>
                <Text className="font-bold text-gray-900">{money(p.amount)}</Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  {p.worker?.fullName ?? 'Worker'} · {localDate(p.paymentDate) ?? '—'}
                </Text>
              </View>
              {p.notes ? (
                <Text className="text-xs text-gray-400 pl-4" numberOfLines={2}>
                  {p.notes}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      {/* Client Payment Modal */}
      <Modal
        visible={showClientModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowClientModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1 bg-white">
            <View className="flex-row justify-between items-center px-6 py-5 border-b border-gray-100">
              <Text className="text-lg font-bold text-gray-900">Record Payment</Text>
              <TouchableOpacity onPress={() => setShowClientModal(false)}>
                <CloseCircle size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                Payment Type
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                {PAYMENT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setCpType(t as ClientPaymentType)}
                    className={`mr-2 px-4 py-2 rounded-xl border ${
                      cpType === t ? 'bg-black border-black' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <Text className={`text-sm font-medium ${cpType === t ? 'text-white' : 'text-gray-700'}`}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                Amount *
              </Text>
              <View className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6">
                <TextInput
                  value={cpAmount}
                  onChangeText={setCpAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  className="text-gray-900"
                />
              </View>
              <TouchableOpacity
                onPress={handleAddClientPayment}
                disabled={isSubmitting || !cpAmount}
                className={`py-4 rounded-2xl items-center flex-row justify-center gap-2 ${
                  isSubmitting || !cpAmount ? 'bg-gray-200' : 'bg-black'
                }`}
              >
                {isSubmitting && <ActivityIndicator size="small" color="#FFFFFF" />}
                <Text className={`font-bold ${isSubmitting || !cpAmount ? 'text-gray-500' : 'text-white'}`}>
                  Save Payment
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Expense Modal */}
      <Modal
        visible={showExpenseModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExpenseModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1 bg-white">
            <View className="flex-row justify-between items-center px-6 py-5 border-b border-gray-100">
              <Text className="text-lg font-bold text-gray-900">Add Expense</Text>
              <TouchableOpacity onPress={() => setShowExpenseModal(false)}>
                <CloseCircle size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                Category
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                {EXPENSE_CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setExpCategory(c)}
                    className={`mr-2 px-4 py-2 rounded-xl border ${
                      expCategory === c ? 'bg-black border-black' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <Text className={`text-sm font-medium ${expCategory === c ? 'text-white' : 'text-gray-700'}`}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                Amount *
              </Text>
              <View className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4">
                <TextInput
                  value={expAmount}
                  onChangeText={setExpAmount}
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
                  value={expDescription}
                  onChangeText={setExpDescription}
                  placeholder="e.g. Drone rental"
                  placeholderTextColor="#9CA3AF"
                  className="text-gray-900"
                />
              </View>
              <TouchableOpacity
                onPress={handleAddExpense}
                disabled={isSubmitting || !expAmount || !expDescription}
                className={`py-4 rounded-2xl items-center flex-row justify-center gap-2 ${
                  isSubmitting || !expAmount || !expDescription ? 'bg-gray-200' : 'bg-black'
                }`}
              >
                {isSubmitting && <ActivityIndicator size="small" color="#FFFFFF" />}
                <Text
                  className={`font-bold ${
                    isSubmitting || !expAmount || !expDescription ? 'text-gray-500' : 'text-white'
                  }`}
                >
                  Add Expense
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Worker Payment Modal */}
      <Modal
        visible={showWorkerModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowWorkerModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1 bg-white">
            <View className="flex-row justify-between items-center px-6 py-5 border-b border-gray-100">
              <Text className="text-lg font-bold text-gray-900">Pay Crew Member</Text>
              <TouchableOpacity onPress={() => setShowWorkerModal(false)}>
                <CloseCircle size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                Crew Member *
              </Text>
              {assignments.length === 0 ? (
                <Text className="text-gray-500 text-sm mb-4">No crew assigned to this booking.</Text>
              ) : (
                <View className="mb-4">
                  {assignments.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      onPress={() => setWpAssignmentId(a.id)}
                      className={`p-3 rounded-xl border mb-2 ${
                        wpAssignmentId === a.id
                          ? 'bg-gray-900 border-gray-900'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <Text
                        className={`font-medium text-sm ${
                          wpAssignmentId === a.id ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {a.worker.fullName}
                        {a.role ? ` · ${a.role}` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                Amount *
              </Text>
              <View className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6">
                <TextInput
                  value={wpAmount}
                  onChangeText={setWpAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  className="text-gray-900"
                />
              </View>
              <TouchableOpacity
                onPress={handleAddWorkerPayment}
                disabled={isSubmitting || !wpAssignmentId || !wpAmount}
                className={`py-4 rounded-2xl items-center flex-row justify-center gap-2 ${
                  isSubmitting || !wpAssignmentId || !wpAmount ? 'bg-gray-200' : 'bg-black'
                }`}
              >
                {isSubmitting && <ActivityIndicator size="small" color="#FFFFFF" />}
                <Text
                  className={`font-bold ${
                    isSubmitting || !wpAssignmentId || !wpAmount ? 'text-gray-500' : 'text-white'
                  }`}
                >
                  Record Payout
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
